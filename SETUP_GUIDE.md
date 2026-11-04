# DataDash — Google Sheets study data collection

## What's included
- `index.html`: full DataDash frontend with onboarding, five background questions, guided training, two tasks, five post-task questions, and final feedback. Uses a clearly marked placeholder for the NEW Apps Script deployment URL so no pilot data is sent to the previous project's endpoint by accident.
- `Code.gs`: Google Apps Script backend. Creates a new Google Sheet with 4 response tabs, balances assignments across four condition×order groups, receives responses, and avoids duplicates on repeated finishes.
- `DataDash_Study_Data_Template.xlsx`: an optional local template. **You do not need to import this file** when using the Apps Script automatic creation procedure below.

## One-time Google setup (requires your own Google account authorization)
1. Go to https://script.google.com/home/projects/create and create a project named **DataDash HCI Pilot**.
2. Open `Code.gs` from this package, copy ALL of it, and replace the editor's existing `Code.gs` contents with it. Save.
3. In the function dropdown select `setupSpreadsheet` and click **Run** once. Grant the requested Google Sheets permissions. The function creates a **new Google spreadsheet** in your Google Drive with tabs: **Participants**, **Task Results**, **Final Feedback**, **Event Log**.
4. Find the new spreadsheet **DataDash HCI Pilot Study — Responses** in Google Drive. Or inspect `Execution log` for the link.
5. In Apps Script select **Deploy → New deployment → Web app**. Set **Execute as: Me**. For anonymous research participants choose **Who has access: Anyone**. Grant authorization and copy the deployed URL ending in `/exec`.
6. Open `index.html`. Replace `PASTE_YOUR_NEW_APPS_SCRIPT_WEB_APP_EXEC_URL_HERE` with that full `/exec` URL. Save.
7. Run `index.html` over a local HTTP server or deploy to GitHub Pages. **Do not run real participant collection in practice mode.**

## Test before recruiting
1. For a frontend-only check open `index.html?practice=1&condition=revisable&order=AB`; repeat with `condition=one-directional&order=BA`. Practice intentionally does NOT write to Sheets.
2. For a storage test open the normal site URL **without** `practice=1`, on a clean browser profile. Complete consent, background, training, both tasks, post-task ratings and final feedback.
3. Confirm: one participant in **Participants**, two rows in **Task Results**, one in **Final Feedback**, and multiple rows in **Event Log**. The participant ID must match across all four tabs.
4. Test a second participant in a separate browser profile or private window, and check that the condition × task-order assignment cycles across all four groups.
5. After editing `Code.gs`, **Deploy → Manage deployments → Edit → New version → Deploy** to publish the new backend code. Existing `/exec` URLs stay unchanged when updating the same deployment.

## Notes and limitations
- Only a connected Google account can authorize Apps Script and create a live spreadsheet. The package contains the backend code but is **not itself an active live endpoint**.
- `index.html` intentionally does not point to the previous deployment. Set the new endpoint URL before actual testing.
- Google Apps Script endpoints exposed to anonymous participants can be spammed; treat the sheet as restricted research data, and monitor for unexpected submissions. These protections are sufficient for a small class pilot, not a hardened production service.
- The Apps Script keeps the 4 assignment groups approximately balanced across allocated IDs, not necessarily fully completed sessions if participants drop out.
- The client remembers completed sessions in browser local storage. A new participant on a shared machine needs a new browser profile or an approved study-reset procedure.
- The final form is written feedback, not an audio/video interview; if your research plan needs researcher-led interviews or recording, conduct those separately with participant consent.
- **No GitHub push was performed** because the connected GitHub integration currently returns HTTP 403 on branch creation, even though the account appears to have `push=true`. You may upload these files to a branch you create yourself.
