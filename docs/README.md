# Titan Protection — Documentation

## Files in this folder

| File | Description |
|------|-------------|
| **Titan-Protection-User-Manual.docx** | Full user manual (Word) — open in Microsoft Word |
| **Titan-Protection-User-Manual.pdf** | PDF export of the user manual |
| **Titan-Protection-System-Walkthrough.html** | Auto-playing presentation for screen recording |
| **generate_user_manual.py** | Script to regenerate the Word manual |
| **export_manual_pdf.py** | Script to export the manual to PDF |
| **../web/public/live-demo-recorder.html** | Side-by-side live web + mobile demo for recording |

---

## How to create the walkthrough video

Since a native video file requires screen recording, follow these steps:

### Option A — Record the HTML presentation (recommended)

1. Open `Titan-Protection-System-Walkthrough.html` in Chrome or Edge (double-click the file).
2. Press **F11** for full-screen.
3. Start Windows screen recording:
   - **Windows 11:** `Win + G` → Capture → Record
   - **Or:** Use OBS Studio (free) for higher quality
4. The presentation auto-advances every 8 seconds (~5–6 minutes total).
5. Read the narration text at the bottom of the screen, or use Appendix A in the User Manual as a voiceover script.
6. Use **Pause**, **Prev**, and **Next** buttons (or arrow keys) to control pacing.

### Option B — Record the live apps (side-by-side)

1. Start the web server: `cd web; npm run dev -- -p 3001`
2. Start the mobile app: `cd mobile; npm run dev`
3. Open **http://localhost:3001/live-demo-recorder.html** in Chrome or Edge (maximize the window).
4. The page loads the Command Centre and Guard app side by side with a 10-step narration script.
5. Press **Win + G** → Capture → Record, then follow each scene (use **Next** / arrow keys, or **Auto-play**).
6. Perform the on-screen actions on the mobile panel (patrol tap, SOS, incident, visitor, checklist).

If the mobile panel is blank, enter the mobile URL shown in the Vite terminal (e.g. `http://localhost:5175`) in the **Mobile** field and click **Reload**.

### Option C — Record two separate windows

1. Start the web server: `cd web && npm run dev`
2. Start the mobile app: `cd mobile && npm run dev`
3. Open both in browser windows side by side.
4. Follow the **Video Walkthrough Script** in Appendix A of the User Manual.
5. Screen-record while demonstrating patrol taps, SOS, incidents, and visitor check-in.

### Option D — Add voiceover later

1. Record the HTML presentation silently.
2. Use the narration in Appendix A of the User Manual.
3. Add voiceover in Clipchamp (built into Windows) or DaVinci Resolve (free).

---

## Export User Manual to PDF

```powershell
python docs/export_manual_pdf.py
```

Output: `docs/Titan-Protection-User-Manual.pdf`

---

## Regenerating the User Manual

```powershell
python docs/generate_user_manual.py
```

---

*Titan Protection — Built to Protect*
