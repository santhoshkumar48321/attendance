# SKILL: Teams Attendance Tracker

## Overview

This skill launches a headless Chromium browser that joins a Microsoft Teams
meeting as a guest, monitors the participant roster, and logs exactly when the
employee **"Santhosh"** joins or leaves the call.

All events are appended to a local CSV file (`attendance_log.csv`) with an ISO
8601 timestamp.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Playwright | 1.58.2 (installed via `npm install`) |

> **Docker alternative:** build and run with the provided `Dockerfile` to skip
> manual dependency setup.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. (Optional) install Chromium explicitly if not using Docker
npx playwright install chromium
```

---

## Execution

### Direct Node.js

```bash
MEETING_URL="https://teams.microsoft.com/l/meetup-join/<your-meeting-id>" node tracker.js
```

### Docker

```bash
# Build the image
docker build -t teams-tracker .

# Run the container, mounting a local directory for the log file
docker run --rm \
  -e MEETING_URL="https://teams.microsoft.com/l/meetup-join/<your-meeting-id>" \
  -v "$(pwd)/logs:/app/logs" \
  teams-tracker
```

---

## OpenClaw Agent Instructions

When an OpenClaw AI agent triggers this skill it should:

1. **Resolve the meeting URL** – Retrieve the Teams meeting link from the
   calendar event or configuration store and set it as the `MEETING_URL`
   environment variable.

2. **Execute the script:**
   ```
   MEETING_URL=<meeting-url> node /path/to/tracker.js
   ```
   or via Docker:
   ```
   docker run --rm -e MEETING_URL=<meeting-url> -v <log-dir>:/app/logs teams-tracker
   ```

3. **Monitor output** – The process prints `[LOG]` lines to stdout whenever
   the target participant joins or leaves.  The agent may capture stdout to
   relay real-time status.

4. **Read the CSV log** – After the meeting, parse `attendance_log.csv` to
   build a structured attendance report.  Each line follows the format:
   ```
   <ISO-8601 timestamp>, <Joined|Left>, Santhosh
   ```

5. **Stop the tracker** – Send `SIGTERM` to the process (or stop the Docker
   container) when monitoring is no longer needed.  The script will clean up
   gracefully.

---

## Output Format

`attendance_log.csv` example:

```
2025-06-10T09:00:15.123Z,Joined,Santhosh
2025-06-10T09:45:02.456Z,Left,Santhosh
2025-06-10T09:51:30.789Z,Joined,Santhosh
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEETING_URL` | *(placeholder)* | Full Teams meeting join URL |
| `LOG_FILE` | `./attendance_log.csv` | Path for the CSV attendance log |

---

## Notes

- The script joins the meeting as a guest named **"."** to remain unobtrusive.
- It waits up to **120 seconds** in the lobby for the host to admit it.
- Roster state is polled every **10 seconds**.
- Camera and microphone are emulated (no real hardware required) via
  `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream`.
