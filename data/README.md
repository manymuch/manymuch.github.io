Home Assistant community visualizations
======================================

`smart-home.json` is a saved snapshot from 2026-10-18. `js/smart-home.js`
refreshes GitHub totals and OSS Insight event data in the browser, caching a
successful refresh for 24 hours. No credentials are used. API failures retain
the saved data. Dates for totals and event data are tracked separately.

The initial chart and map are embedded directly in `index.html`, together with
the data snapshot. They display even without JavaScript, with blocked fetches,
or when live APIs are unavailable. No JSON request is required to display the charts.
After editing either data file, regenerate the embedded SVGs with:

    python scripts/build-smart-home.py

Sources:
- https://api.github.com/repos/manymuch/Xgimi-4-Home-Assistant
- https://api.github.com/repos/manymuch/HisenseHA
- https://ossinsight.io/docs/api/stargazers-history
- https://api.ossinsight.io/v1/repos/manymuch/Xgimi-4-Home-Assistant/stargazers/countries

OSS Insight reports degraded GitHub event coverage. Its cumulative event history
does not equal current GitHub star totals. Geography covers only recorded
stargazers with public locations; it does not measure verified users.

`world-map.json` contains projected Natural Earth 1:110m country polygons and
label positions, excluding Antarctica. Natural Earth data is public domain.
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson
Projection: equirectangular, 640-wide SVG coordinates, rounded to 0.1 units.
