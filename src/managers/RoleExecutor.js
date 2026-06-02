module.exports = {
  run(creep) {
    if (!creep || !creep.memory) {
      return;
    }

    const role = creep.memory.role;
    if (!role) {
      console.log(`[RoleExecutor] Error: Creep ${creep.name} has no role defined in memory.`);
      return;
    }

    try {
      const roleModule = require('../roles/' + role);
      if (roleModule && typeof roleModule.run === 'function') {
        roleModule.run(creep);
      } else {
        console.log(`[RoleExecutor] Error: Role module '${role}' does not export a run() function.`);
      }
    } catch (e) {
      console.log(`[RoleExecutor] Error: Failed to load role module '${role}'. Exception: ${e}`);
    }
  }
};
