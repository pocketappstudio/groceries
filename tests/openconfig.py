# Tests of the app itself run with the license gate off (gate is covered by test_gate.py).
OPEN_CFG="export const LICENSE_PRODUCT_ID='';export const LICENSE_VERIFY_URL='';export const BUY_URL='';export const APP_NAME='Restock';export const APP_VERSION='1.0.0';"
def open_app(browser):
    orig=browser.new_context
    def nc(*a,**k):
        c=orig(*a,**k); c.route('**/config.js',lambda r:r.fulfill(body=OPEN_CFG,content_type='text/javascript')); return c
    browser.new_context=nc; return browser
