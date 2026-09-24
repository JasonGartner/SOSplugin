/* Drop-in replacement for the old SOS WsSubscribers object. */
const WsSubscribers = {
    __subscribers: {},
    websocket: undefined,
    webSocketConnected: false,
    registerQueue: [],
    reconnectTimer: undefined,
    port: 49122,
    debug: false,
    debugFilters: undefined,

    init: function (port, debug, debugFilters) {
        this.port = port || 49122;
        this.debug = Boolean(debug);
        this.debugFilters = debugFilters;
        if (this.websocket && (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING)) return;
        this.connect();
    },

    connect: function () {
        clearTimeout(this.reconnectTimer);
        this.websocket = new WebSocket('ws://127.0.0.1:' + this.port);
        this.websocket.onmessage = event => {
            let message;
            try { message = JSON.parse(event.data); } catch { return; }
            const rawName = message.event || message.Event || message.type || message.Type || '';
            const cleanName = String(rawName).split(':').pop();
            const mapped = this.mapEvent(cleanName);
            const data = message.data ?? message.Data ?? message.payload ?? message.Payload ?? message;
            if (this.debug && (!this.debugFilters || this.debugFilters.indexOf('game:' + mapped) < 0)) console.log('game', mapped, data);
            this.triggerSubscribers('game', mapped, data);
        };
        this.websocket.onopen = () => {
            this.webSocketConnected = true;
            this.triggerSubscribers('ws', 'open');
            this.registerQueue = [];
        };
        this.websocket.onerror = () => {
            this.webSocketConnected = false;
            this.triggerSubscribers('ws', 'error');
        };
        this.websocket.onclose = () => {
            this.webSocketConnected = false;
            this.triggerSubscribers('ws', 'close');
            this.reconnectTimer = setTimeout(() => this.connect(), 2000);
        };
    },

    mapEvent: function (name) {
        const map = {
            UpdateState: 'update_state', GoalScored: 'goal_scored',
            GoalReplayStart: 'replay_start', GoalReplayEnd: 'replay_end',
            CountdownBegin: 'pre_countdown_begin', PreCountdownBegin: 'pre_countdown_begin',
            ClockStopped: 'clock_stopped', MatchEnded: 'match_ended',
            PodiumStart: 'podium_start', MatchCreated: 'match_created', RoundStarted: 'initialized'
        };
        return map[name] || String(name).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    },

    subscribe: function (channels, events, callback) {
        channels = typeof channels === 'string' ? [channels] : channels;
        events = typeof events === 'string' ? [events] : events;
        channels.forEach(channel => events.forEach(event => {
            this.__subscribers[channel] ||= {};
            this.__subscribers[channel][event] ||= [];
            this.__subscribers[channel][event].push(callback);
        }));
    },

    clearEventCallbacks: function (channel, event) {
        if (this.__subscribers[channel]) this.__subscribers[channel][event] = [];
    },

    triggerSubscribers: function (channel, event, data) {
        (this.__subscribers[channel]?.[event] || []).forEach(callback => callback(data));
    },

    send: function (channel, event, data) {
        if (channel === 'local') return this.triggerSubscribers(channel, event, data);
        if (this.websocket?.readyState === WebSocket.OPEN) this.websocket.send(JSON.stringify({ event: channel + ':' + event, data }));
    }
};
