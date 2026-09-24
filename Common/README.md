# Rocket League SOS replacement

This keeps the overlay's existing subscriptions and runs a local compatibility bridge.

1. Install Node.js 20 or newer.
2. In Rocket League's `TAGame\Config\DefaultStatsAPI.ini`, set the Match Stats Exporter port to `49123` and `PacketSendRate=20`, then fully restart Rocket League.
3. Put `sos-replacement.js` beside your overlay HTML.
4. Delete the old `const WsSubscribers = { ... };` block from the HTML and add this immediately before your existing overlay code:

```html
<script src="sos-replacement.js"></script>
```

5. Do not alter your existing `WsSubscribers.subscribe(...)` calls. The replacement ignores repeated `init()` calls and maintains one WebSocket.
6. Run `start-overlay-bridge.bat` before opening the OBS browser source.
7. Keep the HTML and image folders together so all existing relative image paths still work.

The bridge listens on `ws://127.0.0.1:49122`, connects to Rocket League on TCP `127.0.0.1:49123`, and translates current event names to the old SOS names your overlay uses.

If the overlay connects but a field is blank, inspect the bridge console and browser console. The official Stats API payload can differ from the old SOS payload, so that individual field may need a small mapping adjustment based on a real message from your game version.
