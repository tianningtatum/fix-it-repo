package io.github.fixitcrew;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Runs the same game server on a laptop (for testing, or as a backup host).
 *   javac -d build android/app/src/main/java/io/github/fixitcrew/*.java server/DesktopMain.java
 *   java -cp build io.github.fixitcrew.DesktopMain [port] [webFolder]
 */
public final class DesktopMain {
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        final File root = new File(args.length > 1 ? args[1] : "android/app/src/main/assets/web");
        GameServer server = new GameServer(port, new GameServer.Assets() {
            public InputStream open(String path) throws IOException {
                File f = new File(root, path);
                if (!f.getCanonicalPath().startsWith(root.getCanonicalPath())) throw new IOException("bad path");
                return new FileInputStream(f);
            }
        });
        server.start();
        System.out.println("Fix-It Crew server on port " + port);
        for (String ip : GameServer.lanAddresses()) System.out.println("  Players: http://" + ip + ":" + port + "    Host board: http://" + ip + ":" + port + "/host");
        Thread.currentThread().join();
    }
}
