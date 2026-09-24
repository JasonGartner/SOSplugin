const net = require('net');
const { WebSocketServer } = require('ws');

const RL_HOST = '127.0.0.1';
const RL_PORT = 49123;
const WS_PORT = 49122;

const clients = new Set();
let reconnectTimer;

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', socket => {
  clients.add(socket);

  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
  socket.on('message', () => { });
});

function broadcast(message) {
  const json = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(json);
    }
  }
}

function eventName(packet) {
  return packet.Event || packet.event || '';
}

function mapEvent(name) {

  switch (name) {

    case 'UpdateState':
      return 'update_state';

    case 'GoalScored':
      return 'goal_scored';

    case 'GoalReplayStart':
      return 'replay_start';

    case 'GoalReplayEnd':
      return 'replay_end';

    case 'CountdownBegin':
    case 'PreCountdownBegin':
      return 'pre_countdown_begin';

    case 'ClockStopped':
      return 'clock_stopped';

    case 'MatchEnded':
      return 'match_ended';

    case 'matchDestroyed':
      return 'match_ended';

    case 'PodiumStart':
      return 'podium_start';

    case 'MatchCreated':
      return 'match_created';

    default:
      return name.toLowerCase();
  }
}

function convertUpdateState(data) {

  const result = {
    game: {
      teams: [],
      time_seconds: data.Game?.TimeSeconds ?? 0,
      isOT: data.Game?.bOvertime ?? false,
      isReplay: data.Game?.bReplay ?? false,
      hasWinner: data.Game?.bHasWinner ?? false,
      arena: data.Game?.Arena ?? '',
      target: ''
    },
    players: {}
  };

  if (data.Game?.Target) {
    result.game.target =
      `${data.Game.Target.Name}_${data.Game.Target.Shortcut}`;
  }

  if (data.Game?.Teams) {

    result.game.teams = data.Game.Teams.map(team => ({
      name: team.Name,
      score: team.Score,
      color_primary: '#' + team.ColorPrimary
    }));
  }

  if (data.Players) {

    data.Players.forEach(player => {

      const key =
        `${player.Name}_${player.Shortcut}`;

      result.players[key] = {
        boost: player.Boost ?? 0,
        score: player.Score ?? 0,
        goals: player.Goals ?? 0,
        assists: player.Assists ?? 0,
        shots: player.Shots ?? 0,
        saves: player.Saves ?? 0,
        demos: player.Demos ?? 0
      };
    });
  }

  return result;
}

function eventData(packet) {

  let data = packet.Data ?? packet.data ?? packet;

  if (typeof data === 'string') {

    try {
      data = JSON.parse(data);
    }
    catch {
      return data;
    }
  }
  if (
    packet.Event === 'MatchEnded' ||
    packet.Event === 'MatchDestroyed'
  ) {

    return {
      winner_team_num: data.WinnerTeamNum
    };
  }
  if (packet.Event === 'UpdateState') {
    return convertUpdateState(data);
  }

  return data;
}

function connectToRocketLeague() {

  clearTimeout(reconnectTimer);

  const socket = net.createConnection({
    host: RL_HOST,
    port: RL_PORT
  });

  socket.on('connect', () => {
    console.log(`Connected to Rocket League Stats API on ${RL_HOST}:${RL_PORT}`);
  });

  socket.on('data', chunk => {

    try {

      const packet = JSON.parse(chunk.toString('utf8'));

      const event = mapEvent(eventName(packet));

      console.log('EVENT:', event);
      if (event === 'match_ended') {
        console.log('MATCH ENDED DATA');
        console.log(JSON.stringify(eventData(packet), null, 2));
      }
      broadcast({
        event: `game:${event}`,
        data: eventData(packet)
      });

    }
    catch (error) {

      console.error('PARSE ERROR:', error.message);
    }
  });

  socket.on('error', error => {
    console.log(`Rocket League connection: ${error.message}`);
  });

  socket.on('close', () => {

    console.log('Rocket League disconnected. Retrying...');

    reconnectTimer = setTimeout(
      connectToRocketLeague,
      2000
    );
  });
}

console.log(
  `SOS-compatible WebSocket listening on ws://127.0.0.1:${WS_PORT}`
);

connectToRocketLeague();