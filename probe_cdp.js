const http = require("http");
const ws = require("ws");
const PORT = 9223;
const DIR = "/var/folders/n9/mx9fdq511_q4n9byt7g1frfw0000gn/T/kilo";

function jsonReq(path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "localhost", port: PORT, path, method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {} },
      (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(d ? JSON.parse(d) : null)); });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const tabs = await jsonReq("/json/list");
  const tab = tabs.find(t => t.type === "page" && t.url && !t.url.startsWith("chrome://")) || tabs[0];
  const socket = new ws(tab.webSocketDebuggerUrl);
  let id = 0; const pending = {};
  socket.on("open", async () => {
    function send(method, params) {
      return new Promise((res, rej) => { const i = ++id; pending[i] = { res, rej }; socket.send(JSON.stringify({ id: i, method, params: params || {} })); });
    }
    socket.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && pending[m.id]) { pending[m.id].res(m); delete pending[m.id]; }
      if (m.method === "Runtime.consoleAPICalled") {
        console.log(`[CONSOLE ${m.params.type}]`, m.params.args.map(a => a.value || a.description || "").join(" "));
      }
      if (m.method === "Runtime.exceptionThrown") {
        console.log("[EXCEPTION]", m.params.exceptionDetails.text || (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description));
      }
    });
    await send("Network.enable");
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Page.navigate", { url: "http://localhost:3001/patient/login" });
    await new Promise(r => setTimeout(r, 11000));
    // Check page state
    const loc = await send("Runtime.evaluate", { expression: "window.location.href", returnByValue: true, awaitPromise: true });
    console.log("EVAL_LOC_RESP:", JSON.stringify(loc).slice(0, 300));
    const ready = await send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
    console.log("READYSTATE_RESP:", JSON.stringify(ready).slice(0, 200));
    const text = await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
    console.log("BODYTEXT_RESP:", JSON.stringify(text).slice(0, 400));
    const len = await send("Runtime.evaluate", { expression: "document.body.innerHTML.length", returnByValue: true });
    console.log("BODY_LEN_RESP:", JSON.stringify(len).slice(0, 200));
    const html = await send("Runtime.evaluate", { expression: "document.body.innerHTML", returnByValue: true });
    console.log("BODY_HTML_RESP:", JSON.stringify(html).slice(0, 2500));
    const cap = await send("Page.captureScreenshot", { format: "png" });
    console.log("CAP_RESP:", JSON.stringify(cap).slice(0, 300));
    process.exit(0);
  });
  socket.on("error", e => { console.log("WS_ERR", e.message); process.exit(1); });
}
main().catch(e => { console.error(e); process.exit(1); });
