function createUserRoute(users) {
  function displayName(id) {
    return users[id].name;
  }
  return (id) => {
    if (!Object.hasOwn(users, id)) return { status: 404, body: 'Missing user' };
    return { status: 200, body: displayName(id) };
  };
}

module.exports = { createUserRoute };
