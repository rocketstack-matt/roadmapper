// Runs a Redis Lua script (redis.eval) against the in-memory Map the tests
// use for Redis, with a real Lua interpreter (fengari), so the script under
// test is the one production sends. Supports the commands the scripts use:
// HGET and HSET on hashes stored as plain objects. Runs synchronously, so,
// as in Redis, nothing else touches the store while a script runs.
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');

const luaValue = (L, index) => (lua.lua_isnil(L, index) ? null : to_jsstring(lua.lua_tostring(L, index)));

const runCommand = (store, args) => {
  const [command, key, ...rest] = args;
  const hash = store.get(key) || {};
  switch (command.toUpperCase()) {
    case 'HGET':
      return Object.prototype.hasOwnProperty.call(hash, rest[0]) ? String(hash[rest[0]]) : null;
    case 'HSET': {
      const updated = { ...hash };
      for (let i = 0; i < rest.length; i += 2) updated[rest[i]] = rest[i + 1];
      store.set(key, updated);
      return rest.length / 2;
    }
    default:
      throw new Error(`redis-lua: unsupported command ${command}`);
  }
};

const pushTable = (L, name, values) => {
  lua.lua_createtable(L, values.length, 0);
  values.forEach((value, i) => {
    lua.lua_pushstring(L, to_luastring(String(value)));
    lua.lua_rawseti(L, -2, i + 1);
  });
  lua.lua_setglobal(L, to_luastring(name));
};

const evalLua = (store, script, keys, args) => {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  lua.lua_createtable(L, 0, 1);
  lua.lua_pushcfunction(L, (state) => {
    const callArgs = [];
    for (let i = 1; i <= lua.lua_gettop(state); i++) callArgs.push(luaValue(state, i));
    const result = runCommand(store, callArgs);
    // Redis turns a nil reply into false
    if (result === null) lua.lua_pushboolean(state, false);
    else if (typeof result === 'number') lua.lua_pushinteger(state, result);
    else lua.lua_pushstring(state, to_luastring(result));
    return 1;
  });
  lua.lua_setfield(L, -2, to_luastring('call'));
  lua.lua_setglobal(L, to_luastring('redis'));
  pushTable(L, 'KEYS', keys);
  pushTable(L, 'ARGV', args);

  if (lauxlib.luaL_dostring(L, to_luastring(script)) !== lua.LUA_OK) {
    throw new Error(`redis-lua: ${to_jsstring(lua.lua_tostring(L, -1))}`);
  }
  if (lua.lua_isnumber(L, -1)) return lua.lua_tointeger(L, -1);
  return luaValue(L, -1);
};

module.exports = { evalLua };
