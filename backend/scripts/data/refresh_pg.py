"""Re-run the PG (postgraduate) capture pipeline on demand and print the
result as JSON to stdout.

Source: MCC's (Medical Counselling Committee) "Participating Institute
Details" tool, linked from https://mcc.nic.in/pg-medical-counselling/. There
is no PDF or JSON API for this — it's a legacy ASP.NET WebForms page whose
results table is rendered via DataTables with `serverSide: false`, meaning
ALL ~1,940 rows are loaded into the page's JS memory even though only 10 are
ever visible in the DOM at once (paginated display). A plain HTTP scrape of
the rendered HTML would only see those 10 — this has to run inside a real
browser and read `DataTable().rows().data()` directly, hence Playwright
rather than requests+BeautifulSoup (compare refresh_ug.py, which doesn't
need this because the NMC/NIRF sources are static file downloads).

The "enc=" link parameter changes with each counselling year (2025 -> 2026,
etc.), so this doesn't hardcode it — it re-finds the current "Participating
Institute Details" link from the MCC PG counselling page on every run.

Capture only: never touches the database. See refresh_ug.py's docstring —
same diff-preview contract applies, enforced by the backend, not here.
"""
import json
import re
import sys

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

MCC_PG_PAGE = "https://mcc.nic.in/pg-medical-counselling/"
HEADERS = {"User-Agent": "Mozilla/5.0 (UniscopeDataImport/1.0)"}
TABLE_ID = "ctl00_ContentPlaceHolder1_GrViewInstitute"


def find_entry_url() -> str:
    resp = requests.get(MCC_PG_PAGE, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for a in soup.find_all("a", href=True):
        if "participating institute details" in a.get_text(strip=True).lower():
            return a["href"]
    raise RuntimeError(
        "Could not find the 'Participating Institute Details' link on "
        f"{MCC_PG_PAGE} — MCC may have restructured the page."
    )


def scrape(entry_url: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(entry_url, wait_until="networkidle", timeout=60_000)

        # Three cascading dropdowns: Type of Institute -> Institutes -> Program.
        # Each "All" selection triggers a real ASP.NET postback (full page
        # reload) except the last, which just primes the value for Submit.
        # The <select> is visually replaced by the jQuery "Chosen" plugin
        # (hidden, 0x0) so Playwright's select_option() times out waiting
        # for visibility — set .value directly and dispatch the change
        # event ourselves, same as the underlying widget does on a real click.
        def select_all(selector: str):
            # dispatch is wrapped in expect_navigation because the page's own
            # onchange handler fires __doPostBack via setTimeout(...,0) — the
            # postback (full reload) starts a tick after dispatch returns,
            # so waiting on load-state immediately after would race it.
            with page.expect_navigation(wait_until="networkidle", timeout=30_000):
                page.eval_on_selector(
                    selector,
                    "el => { el.value = 'All'; el.dispatchEvent(new Event('change', {bubbles: true})); }",
                )

        select_all("#ctl00_ContentPlaceHolder1_ddlInstType")
        select_all("#ctl00_ContentPlaceHolder1_ddlInstitutes")

        page.eval_on_selector(
            "#ctl00_ContentPlaceHolder1_ddlprogram",
            "el => { el.value = 'All'; el.dispatchEvent(new Event('change', {bubbles: true})); }",
        )
        # Unlike the dropdowns, Submit runs inside an UpdatePanel (AJAX
        # partial postback, no real navigation event) — wait on the table
        # actually appearing and becoming a live DataTable instead of on
        # navigation/network-idle, neither of which fires here.
        page.click("#ctl00_ContentPlaceHolder1_btnsubmit")
        page.wait_for_selector(f"#{TABLE_ID}", timeout=45_000)
        page.wait_for_function(
            f"() => window.jQuery && jQuery.fn.dataTable.isDataTable('#{TABLE_ID}')",
            timeout=30_000,
        )

        # Pull every row out of the DataTable's in-memory store, not the DOM
        # (see module docstring) — columns are [S.No, InstId(+markup),
        # InstDescription(+markup), ViewProfile link, ViewBond link].
        raw = page.evaluate(
            f"""() => {{
                const dt = jQuery('#{TABLE_ID}').DataTable();
                return dt.rows().data().toArray();
            }}"""
        )
        browser.close()

    rows = []
    for r in raw:
        code_m = re.search(r'lblInstId">([^<]+)<', r[1])
        name_m = re.search(r'lblInstDescription">([^<]+)<', r[2])
        if code_m and name_m:
            rows.append({"code": code_m.group(1), "name": name_m.group(1)})
    return rows


def main():
    entry_url = find_entry_url()
    rows = scrape(entry_url)
    json.dump(rows, sys.stdout)


if __name__ == "__main__":
    main()
