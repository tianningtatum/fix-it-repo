# Fix-It Crew

A team repair game for engineering classes. One phone is the **operator** and sees a broken machine. Everyone else holds a different page of the repair manual. The only way to fix it is to talk.

Four programs, one app:

| Game | Program | Machine |
|---|---|---|
| Crane Crisis | Civil Engineering | Tower crane controller |
| Relay Rescue | Electrical Engineering | Protection relay panel |
| Debug Squad | Computer Engineering | Embedded controller board |
| Chiller Chaos | Mechanical Engineering | Chiller plant controller |

## Download

**[Get the latest APK →](../../releases/latest)** (file: `FixItCrew.apk`)

Only the **host** needs the app, and the host must be an **Android** phone (Android 8 or newer). Players on **iPhone or Android** don't install anything. They join in Safari or Chrome.

## Running a class

1. Install `FixItCrew.apk` on the host phone. Android will ask you to allow installing from your browser or file manager; allow it once.
2. On the host phone, turn on the **mobile hotspot** (or connect it to the classroom Wi-Fi).
3. Open **Fix-It Crew**. It shows a QR code and an address like `192.168.43.1:8080`.
4. Players connect to the same hotspot or Wi-Fi, then scan the QR code (or type the address).
5. Each player picks their program, types their name and a **team code**. Teammates use the same team code.
6. When everyone's in, anyone on the team taps **Start game**.

No internet is needed. Keep the host app open; it also keeps running in the background while the notification "Fix-It Crew is hosting" is showing.

**How many phones?** One phone hotspot usually handles about 8–10 devices. For a whole class, put the host phone and all players on the classroom Wi-Fi router instead, and run several teams from one host.

## How a round works

- Each round, one player is the operator. Their phone shows the machine (wires, a gauge, symbol keys, switches, a start-up sequence) and a timer.
- Everyone else sees only their manual pages. The operator describes; the manual holders say what to do.
- 3 mistakes or running out of time fails the round and costs 1 of the team's 3 spare parts.
- The operator changes every round. Machines get more modules as the team improves.
- When the game ends, every phone on the team shows the same report with a **check code**. Students screenshot it or tap **Copy log** to submit.

## Teacher tools

On the host phone, scroll down the host board for:

- **Check a student's log**: paste a submitted log to confirm it wasn't edited.
- **Skip operator**: if a player's phone dies on their turn.
- **Close team**.
- Debrief questions per program, and what each part of the game trains.

## For developers

- `android/` — the Android app. The game server (`GameServer.java`) has no dependencies: plain HTTP for pages and actions, Server-Sent Events for live updates.
- `android/app/src/main/assets/web/` — the game itself (HTML/JS), served to players' browsers.
- `server/DesktopMain.java` — runs the same server on a laptop:
  ```
  javac -d build android/app/src/main/java/io/github/fixitcrew/Json.java android/app/src/main/java/io/github/fixitcrew/GameServer.java server/DesktopMain.java
  java -cp build io.github.fixitcrew.DesktopMain 8080 android/app/src/main/assets/web
  ```
- Every push to `main` builds a signed APK with GitHub Actions and publishes it as a new release.
