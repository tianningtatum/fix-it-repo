package io.github.fixitcrew;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Fix-It Crew game server. Zero dependencies, so it runs the same on Android and a desktop JVM.
 * HTTP for pages and actions, Server-Sent Events for live updates (works in iPhone Safari).
 * The server keeps each team's room state; every phone builds the same machine and manual
 * from that state with core.js, and the operator's phone reports solves and faults.
 */
public final class GameServer {

    /** Where the web files come from (Android assets or a folder on disk). */
    public interface Assets { InputStream open(String path) throws IOException; }

    private static final Charset UTF8 = Charset.forName("UTF-8");
    private static final int MAX_PLAYERS = 8, LIVES = 3, MAX_FAULTS = 3;
    private static final String[] PROGRAMS = {"ce", "ee", "cpe", "me"};

    private final int port;
    private final Assets assets;
    private final Object lock = new Object();
    private final Map<String, Room> rooms = new LinkedHashMap<String, Room>();
    private final List<Client> hostClients = new CopyOnWriteArrayList<Client>();
    private final Random random = new Random();
    private volatile boolean running;
    private volatile boolean hostDirty = true;
    private int target = 5;
    private final List<Map<String, Object>> finishers = new ArrayList<Map<String, Object>>();
    private ServerSocket serverSocket;
    private ExecutorService pool;
    private Thread acceptThread, tickThread;

    public GameServer(int port, Assets assets) { this.port = port; this.assets = assets; }

    // ================================================================ model
    static final class Client {
        final LinkedBlockingQueue<String> queue = new LinkedBlockingQueue<String>();
        void push(String msg) { queue.clear(); queue.offer(msg); }
    }

    static final class Player {
        String id, name; int station; boolean online; long offlineSince;
        final List<Client> clients = new CopyOnWriteArrayList<Client>();
    }

    static final class Room {
        String key, name, program;
        final List<Player> players = new ArrayList<Player>();
        String state = "lobby"; // lobby | playing | over
        int n, k, round = 1, fixed, lives = LIVES;
        long seed;
        final List<Map<String, Object>> hist = new ArrayList<Map<String, Object>>();
        String phase = "brief"; // brief | repair | result
        long repairStart, timeMs, resultAt;
        int faults, modules;
        final Set<Integer> solved = new LinkedHashSet<Integer>();
        String result, why, ended;
        int rank; long finishedAt, raceStart, raceMs;
        long emptySince;
        boolean dirty = true;

        Player find(String id) { for (Player p : players) if (p.id.equals(id)) return p; return null; }
        int operator() { return n > 0 ? k % n : 0; }
    }

    // ================================================================ lifecycle
    public void start() throws IOException {
        running = true;
        serverSocket = new ServerSocket();
        serverSocket.setReuseAddress(true);
        serverSocket.bind(new InetSocketAddress("0.0.0.0", port));
        pool = Executors.newCachedThreadPool();
        acceptThread = new Thread(new Runnable() {
            public void run() {
                while (running) {
                    try {
                        final Socket s = serverSocket.accept();
                        pool.execute(new Runnable() { public void run() { handle(s); } });
                    } catch (IOException e) {
                        if (!running) break;
                    }
                }
            }
        }, "fixit-accept");
        acceptThread.start();
        tickThread = new Thread(new Runnable() {
            public void run() {
                long lastPing = 0;
                while (running) {
                    try { Thread.sleep(250); } catch (InterruptedException e) { break; }
                    try {
                        tick();
                        long now = System.currentTimeMillis();
                        if (now - lastPing > 15000) { lastPing = now; }
                    } catch (RuntimeException e) { e.printStackTrace(); }
                }
            }
        }, "fixit-tick");
        tickThread.start();
    }

    public void stop() {
        running = false;
        try { if (serverSocket != null) serverSocket.close(); } catch (IOException ignored) { }
        if (pool != null) pool.shutdownNow();
        if (tickThread != null) tickThread.interrupt();
    }

    public int getPort() { return port; }

    public static List<String> lanAddresses() {
        List<String> out = new ArrayList<String>();
        try {
            Enumeration<NetworkInterface> ifs = NetworkInterface.getNetworkInterfaces();
            if (ifs == null) return out;
            for (NetworkInterface ni : Collections.list(ifs)) {
                try { if (!ni.isUp() || ni.isLoopback()) continue; } catch (Exception e) { continue; }
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLoopbackAddress()) {
                        String ip = a.getHostAddress();
                        // hotspot and Wi-Fi addresses first
                        if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) out.add(0, ip); else out.add(ip);
                    }
                }
            }
        } catch (Exception ignored) { }
        return out;
    }

    // ================================================================ game logic
    private static String clean(Object o, int max) {
        String s = o == null ? "" : String.valueOf(o);
        s = s.replaceAll("[\\u0000-\\u001f\\u007f<>]", "").replaceAll("\\s+", " ").trim();
        return s.length() > max ? s.substring(0, max) : s;
    }
    private static String roomKey(String team) {
        return clean(team, 24).toUpperCase().replaceAll("[^A-Z0-9]", "");
    }
    private static int num(Object o, int def) {
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(String.valueOf(o)); } catch (Exception e) { return def; }
    }

    private Map<String, Object> join(Map<String, Object> b) {
        String id = clean(b.get("id"), 48), name = clean(b.get("name"), 16), key = roomKey(String.valueOf(b.get("team")));
        String program = clean(b.get("program"), 4);
        boolean okProgram = false; for (String p : PROGRAMS) if (p.equals(program)) okProgram = true;
        if (id.isEmpty() || name.isEmpty() || key.length() < 2) return err("Type your name and a team code (at least 2 letters or numbers).");
        if (!okProgram) return err("Pick your program.");
        synchronized (lock) {
            Room r = rooms.get(key);
            if (r == null) {
                r = new Room(); r.key = key; r.name = key; r.program = program;
                rooms.put(key, r);
            }
            Player p = r.find(id);
            if (p == null) {
                if (!"lobby".equals(r.state) && !"over".equals(r.state)) return err("Team " + r.key + " is already playing. Wait for them to finish, or use a different team code.");
                if (r.players.size() >= MAX_PLAYERS) return err("Team " + r.key + " is full (" + MAX_PLAYERS + " phones max).");
                for (Player x : r.players) if (x.name.equalsIgnoreCase(name)) return err("Someone in team " + r.key + " already uses that name.");
                p = new Player(); p.id = id; p.name = name; p.station = r.players.size(); p.offlineSince = System.currentTimeMillis();
                r.players.add(p);
            } else p.name = name;
            r.dirty = true;
            Map<String, Object> out = new LinkedHashMap<String, Object>();
            out.put("ok", true); out.put("room", r.key); out.put("program", r.program);
            return out;
        }
    }

    private Map<String, Object> act(Map<String, Object> b) {
        synchronized (lock) {
            Room r = rooms.get(clean(b.get("room"), 40));
            Player p = r == null ? null : r.find(clean(b.get("id"), 48));
            if (p == null) return err("gone");
            String type = clean(b.get("type"), 16);
            long now = System.currentTimeMillis();
            int k = num(b.get("k"), -1);
            boolean isOp = "playing".equals(r.state) && p.station == r.operator();

            if ("start".equals(type) && ("lobby".equals(r.state) || "over".equals(r.state))) {
                // drop anyone who left, then renumber stations in join order
                for (Iterator<Player> it = r.players.iterator(); it.hasNext(); ) { Player x = it.next(); if (!x.online && x.clients.isEmpty() && x != p) it.remove(); }
                if (r.players.size() < 2) return err("You need at least 2 phones on the team.");
                for (int i = 0; i < r.players.size(); i++) r.players.get(i).station = i;
                r.n = r.players.size(); r.seed = 100000 + random.nextInt(900000);
                if (r.raceStart == 0) r.raceStart = now; // race clock runs from the team's first Start, through any replays
                r.k = 0; r.round = 1; r.fixed = 0; r.lives = LIVES; r.hist.clear(); r.ended = null;
                r.state = "playing"; resetRound(r);
            } else if ("repair".equals(type) && isOp && k == r.k && "brief".equals(r.phase)) {
                r.phase = "repair"; r.repairStart = now; r.faults = 0; r.solved.clear();
                r.modules = Math.max(1, Math.min(5, num(b.get("total"), 1)));
                r.timeMs = Math.max(60000, Math.min(600000, num(b.get("timeMs"), 180000)));
            } else if ("fault".equals(type) && isOp && k == r.k && "repair".equals(r.phase)) {
                r.faults++;
                if (r.faults >= MAX_FAULTS) finish(r, "fail", "Three mistakes");
            } else if ("solve".equals(type) && isOp && k == r.k && "repair".equals(r.phase)) {
                int i = num(b.get("i"), -1);
                if (i >= 0 && i < r.modules) r.solved.add(i);
                if (r.solved.size() >= r.modules) finish(r, "ok", "All modules fixed");
            } else if ("next".equals(type) && "playing".equals(r.state) && k == r.k && "result".equals(r.phase)) {
                advance(r);
            } else if ("end".equals(type) && "playing".equals(r.state)) {
                r.state = "over"; r.ended = "ended";
            } else if ("lobby".equals(type) && "over".equals(r.state)) {
                r.state = "lobby";
            } else if ("leave".equals(type) && !"playing".equals(r.state)) {
                r.players.remove(p);
                for (Client c : p.clients) c.push("{\"left\":true}");
            }
            r.dirty = true;
            Map<String, Object> out = new LinkedHashMap<String, Object>();
            out.put("ok", true);
            return out;
        }
    }

    private void resetRound(Room r) {
        r.phase = "brief"; r.faults = 0; r.solved.clear(); r.modules = 0; r.result = null; r.why = null; r.repairStart = 0;
    }
    private void finish(Room r, String result, String why) {
        r.phase = "result"; r.result = result; r.why = why; r.resultAt = System.currentTimeMillis();
    }
    private void advance(Room r) {
        Map<String, Object> h = new LinkedHashMap<String, Object>();
        h.put("r", r.round); h.put("op", r.operator() + 1); h.put("res", r.result);
        r.hist.add(h);
        if ("ok".equals(r.result)) { r.fixed++; r.round++; }
        else if ("fail".equals(r.result)) r.lives--;
        r.k++;
        resetRound(r);
        if (r.fixed >= target) {
            r.state = "over"; r.ended = "target";
            if (r.rank == 0) {
                r.finishedAt = System.currentTimeMillis();
                r.raceMs = r.finishedAt - (r.raceStart > 0 ? r.raceStart : r.finishedAt);
                r.rank = finishers.size() + 1;
                Map<String, Object> f = new LinkedHashMap<String, Object>();
                f.put("rank", r.rank); f.put("team", r.key); f.put("program", r.program); f.put("at", r.finishedAt);
                f.put("fixed", r.fixed); f.put("target", target); f.put("raceMs", r.raceMs);
                List<Object> names = new ArrayList<Object>(); for (Player p : r.players) names.add(p.name);
                f.put("players", names);
                finishers.add(f);
            }
        } else if (r.lives <= 0) { r.state = "over"; r.ended = "out"; }
    }

    private Map<String, Object> hostAct(Map<String, Object> b) {
        synchronized (lock) {
            String type = clean(b.get("type"), 16);
            if ("target".equals(type)) {
                target = Math.max(1, Math.min(20, num(b.get("n"), target)));
                for (Room x : rooms.values()) x.dirty = true;
                hostDirty = true;
                Map<String, Object> out = new LinkedHashMap<String, Object>(); out.put("ok", true); return out;
            }
            if ("resetBoard".equals(type)) {
                finishers.clear();
                long t = System.currentTimeMillis();
                for (Room x : rooms.values()) { x.rank = 0; x.finishedAt = 0; x.raceMs = 0; x.raceStart = "playing".equals(x.state) ? t : 0; x.dirty = true; }
                hostDirty = true;
                Map<String, Object> out = new LinkedHashMap<String, Object>(); out.put("ok", true); return out;
            }
            Room r = rooms.get(clean(b.get("room"), 40));
            if (r == null) return err("gone");
            if ("skip".equals(type) && "playing".equals(r.state)) {
                r.result = "skip"; advance(r);
            } else if ("close".equals(type)) {
                for (Player p : r.players) for (Client c : p.clients) c.push("{\"closed\":true}");
                rooms.remove(r.key);
            }
            r.dirty = true; hostDirty = true;
            Map<String, Object> out = new LinkedHashMap<String, Object>(); out.put("ok", true); return out;
        }
    }

    private void tick() {
        long now = System.currentTimeMillis();
        synchronized (lock) {
            for (Iterator<Room> it = rooms.values().iterator(); it.hasNext(); ) {
                Room r = it.next();
                if ("playing".equals(r.state)) {
                    if ("repair".equals(r.phase) && now - r.repairStart > r.timeMs + 1500) { finish(r, "fail", "Out of time"); r.dirty = true; }
                    if ("result".equals(r.phase) && now - r.resultAt > 20000) { advance(r); r.dirty = true; }
                } else {
                    for (Iterator<Player> pi = r.players.iterator(); pi.hasNext(); ) {
                        Player p = pi.next();
                        if (!p.online && "lobby".equals(r.state) && now - p.offlineSince > 45000) { pi.remove(); r.dirty = true; }
                    }
                    if ("lobby".equals(r.state)) for (int i = 0; i < r.players.size(); i++) r.players.get(i).station = i;
                }
                boolean anyOnline = false; for (Player p : r.players) if (p.online) anyOnline = true;
                if (!anyOnline) { if (r.emptySince == 0) r.emptySince = now; if (now - r.emptySince > 20 * 60000) { it.remove(); hostDirty = true; continue; } }
                else r.emptySince = 0;
                if (r.dirty) { flush(r); hostDirty = true; }
            }
        }
        if (hostDirty && !hostClients.isEmpty()) {
            hostDirty = false;
            String v;
            synchronized (lock) { v = Json.write(hostView()); }
            for (Client c : hostClients) c.push(v);
        }
    }

    private void flush(Room r) {
        r.dirty = false;
        for (Player p : r.players) {
            if (p.clients.isEmpty()) continue;
            String v = Json.write(playerView(r, p));
            for (Client c : p.clients) c.push(v);
        }
    }

    private Map<String, Object> roomView(Room r) {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("key", r.key); m.put("program", r.program); m.put("state", r.state); m.put("n", r.n); m.put("seed", r.seed);
        m.put("k", r.k); m.put("round", r.round); m.put("fixed", r.fixed); m.put("lives", r.lives); m.put("hist", r.hist);
        m.put("phase", r.phase); m.put("repairStart", r.repairStart); m.put("timeMs", r.timeMs); m.put("faults", r.faults);
        m.put("solved", new ArrayList<Integer>(r.solved)); m.put("modules", r.modules); m.put("result", r.result); m.put("why", r.why);
        m.put("ended", r.ended); m.put("operator", r.operator());
        m.put("target", target); m.put("rank", r.rank); m.put("finishedAt", r.finishedAt);
        m.put("raceStart", r.raceStart); m.put("raceMs", r.raceMs); m.put("teamsOnHost", rooms.size());
        List<Object> ps = new ArrayList<Object>();
        for (Player p : r.players) {
            Map<String, Object> x = new LinkedHashMap<String, Object>();
            x.put("name", p.name); x.put("station", p.station); x.put("online", p.online);
            ps.add(x);
        }
        m.put("players", ps);
        return m;
    }
    private Map<String, Object> playerView(Room r, Player p) {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("now", System.currentTimeMillis());
        Map<String, Object> me = new LinkedHashMap<String, Object>();
        me.put("id", p.id); me.put("name", p.name); me.put("station", p.station);
        m.put("me", me); m.put("room", roomView(r));
        return m;
    }
    private Map<String, Object> hostView() {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("now", System.currentTimeMillis());
        List<Object> rs = new ArrayList<Object>();
        for (Room r : rooms.values()) rs.add(roomView(r));
        m.put("rooms", rs);
        m.put("target", target);
        m.put("finishers", new ArrayList<Object>(finishers));
        return m;
    }
    private static Map<String, Object> err(String msg) {
        Map<String, Object> m = new LinkedHashMap<String, Object>(); m.put("ok", false); m.put("error", msg); return m;
    }

    // ================================================================ HTTP
    private void handle(Socket s) {
        try {
            s.setSoTimeout(20000);
            s.setTcpNoDelay(true);
            InputStream in = s.getInputStream();
            OutputStream out = s.getOutputStream();
            String head = readHead(in);
            if (head == null) { s.close(); return; }
            String[] lines = head.split("\r\n");
            String[] rl = lines[0].split(" ");
            if (rl.length < 2) { s.close(); return; }
            String method = rl[0], target = rl[1];
            Map<String, String> headers = new HashMap<String, String>();
            for (int i = 1; i < lines.length; i++) {
                int c = lines[i].indexOf(':');
                if (c > 0) headers.put(lines[i].substring(0, c).trim().toLowerCase(), lines[i].substring(c + 1).trim());
            }
            String path = target, query = "";
            int q = target.indexOf('?');
            if (q >= 0) { path = target.substring(0, q); query = target.substring(q + 1); }
            Map<String, String> params = parseQuery(query);

            if ("GET".equals(method) && "/events".equals(path)) { playerStream(s, out, params); return; }
            if ("GET".equals(method) && "/host/events".equals(path)) { hostStream(s, out); return; }

            if ("POST".equals(method)) {
                int len = 0;
                try { len = Integer.parseInt(headers.containsKey("content-length") ? headers.get("content-length") : "0"); } catch (NumberFormatException ignored) { }
                if (len > 16384) { send(out, 413, "text/plain", "Too large".getBytes(UTF8)); s.close(); return; }
                byte[] body = readN(in, len);
                Map<String, Object> b = Json.obj(new String(body, UTF8));
                Map<String, Object> res;
                if ("/api/join".equals(path)) res = join(b);
                else if ("/api/act".equals(path)) res = act(b);
                else if ("/host/act".equals(path)) res = hostAct(b);
                else res = err("Not found");
                send(out, Boolean.TRUE.equals(res.get("ok")) ? 200 : 400, "application/json", Json.write(res).getBytes(UTF8));
                s.close();
                return;
            }
            if ("GET".equals(method) && "/api/info".equals(path)) {
                Map<String, Object> m = new LinkedHashMap<String, Object>();
                m.put("port", port); m.put("ips", lanAddresses());
                send(out, 200, "application/json", Json.write(m).getBytes(UTF8));
                s.close();
                return;
            }
            if ("GET".equals(method)) {
                String file = path.equals("/") ? "index.html" : path.equals("/host") ? "host.html" : path.substring(1);
                if (file.contains("..") || !file.matches("[A-Za-z0-9_./-]+")) { send(out, 404, "text/plain", "Not found".getBytes(UTF8)); s.close(); return; }
                byte[] data;
                try {
                    InputStream a = assets.open(file);
                    data = readAll(a);
                    a.close();
                } catch (IOException e) {
                    send(out, 404, "text/plain", "Not found".getBytes(UTF8)); s.close(); return;
                }
                send(out, 200, contentType(file), data);
                s.close();
                return;
            }
            send(out, 405, "text/plain", "Method not allowed".getBytes(UTF8));
            s.close();
        } catch (IOException e) {
            try { s.close(); } catch (IOException ignored) { }
        }
    }

    private void playerStream(Socket s, OutputStream out, Map<String, String> params) throws IOException {
        Client c = new Client();
        Player p;
        Room r;
        synchronized (lock) {
            r = rooms.get(params.containsKey("room") ? params.get("room") : "");
            p = r == null ? null : r.find(params.containsKey("id") ? params.get("id") : "");
            if (p != null) { p.clients.add(c); p.online = true; r.dirty = true; c.push(Json.write(playerView(r, p))); }
        }
        sseHead(out);
        if (p == null) { out.write("event: gone\ndata: {}\n\n".getBytes(UTF8)); out.flush(); s.close(); return; }
        try { pump(s, out, c); }
        finally {
            synchronized (lock) {
                p.clients.remove(c);
                if (p.clients.isEmpty()) { p.online = false; p.offlineSince = System.currentTimeMillis(); }
                r.dirty = true;
            }
            try { s.close(); } catch (IOException ignored) { }
        }
    }

    private void hostStream(Socket s, OutputStream out) throws IOException {
        Client c = new Client();
        synchronized (lock) { c.push(Json.write(hostView())); }
        hostClients.add(c);
        sseHead(out);
        try { pump(s, out, c); }
        finally { hostClients.remove(c); try { s.close(); } catch (IOException ignored) { } }
    }

    private void pump(Socket s, OutputStream out, Client c) {
        try {
            s.setSoTimeout(0);
            while (running) {
                String msg = c.queue.poll(15, TimeUnit.SECONDS);
                if (msg == null) out.write(":\n\n".getBytes(UTF8));
                else if (msg.startsWith("{\"closed\"")) { out.write(("event: closed\ndata: {}\n\n").getBytes(UTF8)); out.flush(); return; }
                else if (msg.startsWith("{\"left\"")) { out.write(("event: gone\ndata: {}\n\n").getBytes(UTF8)); out.flush(); return; }
                else out.write(("data: " + msg + "\n\n").getBytes(UTF8));
                out.flush();
            }
        } catch (Exception ignored) { }
    }

    private static void sseHead(OutputStream out) throws IOException {
        out.write(("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream; charset=utf-8\r\nCache-Control: no-cache, no-transform\r\n"
                + "Connection: keep-alive\r\nX-Accel-Buffering: no\r\n\r\nretry: 1500\n\n").getBytes(UTF8));
        out.flush();
    }

    private static void send(OutputStream out, int code, String type, byte[] body) throws IOException {
        String status = code == 200 ? "OK" : code == 404 ? "Not Found" : code == 400 ? "Bad Request" : "Error";
        String h = "HTTP/1.1 " + code + " " + status + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length
                + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        out.write(h.getBytes(UTF8));
        out.write(body);
        out.flush();
    }

    private static String contentType(String f) {
        if (f.endsWith(".html")) return "text/html; charset=utf-8";
        if (f.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (f.endsWith(".css")) return "text/css; charset=utf-8";
        if (f.endsWith(".svg")) return "image/svg+xml";
        if (f.endsWith(".png")) return "image/png";
        if (f.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private static String readHead(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int state = 0;
        while (b.size() < 16384) {
            int c = in.read();
            if (c < 0) return b.size() == 0 ? null : new String(b.toByteArray(), UTF8);
            b.write(c);
            if ((state == 0 || state == 2) && c == '\r') state++;
            else if ((state == 1 || state == 3) && c == '\n') state++;
            else state = c == '\r' ? 1 : 0;
            if (state == 4) return new String(b.toByteArray(), 0, b.size() - 4, UTF8);
        }
        return null;
    }
    private static byte[] readN(InputStream in, int n) throws IOException {
        byte[] buf = new byte[n];
        int off = 0;
        while (off < n) { int r = in.read(buf, off, n - off); if (r < 0) break; off += r; }
        return buf;
    }
    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int r;
        while ((r = in.read(buf)) > 0) b.write(buf, 0, r);
        return b.toByteArray();
    }
    private static Map<String, String> parseQuery(String q) {
        Map<String, String> m = new HashMap<String, String>();
        if (q == null || q.isEmpty()) return m;
        for (String kv : q.split("&")) {
            int e = kv.indexOf('=');
            try {
                if (e > 0) m.put(URLDecoder.decode(kv.substring(0, e), "UTF-8"), URLDecoder.decode(kv.substring(e + 1), "UTF-8"));
            } catch (Exception ignored) { }
        }
        return m;
    }
}
