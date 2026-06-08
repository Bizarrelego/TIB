class CreepBodyUtility {
    /**
     * Dynamically generates the mathematically optimal body array for a given role and exact energy capacity.
     * Overrides strict tier caps to squeeze every drop of energy out of available extensions.
     */
    static getBody(role, energyCapacity) {
        energyCapacity = energyCapacity || 300;
        
        switch (role) {
            case 'harvester': return this.generateHarvester(energyCapacity);
            case 'hauler': return this.generateHauler(energyCapacity);
            case 'upgrader': return this.generateUpgrader(energyCapacity);
            case 'builder': return this.generateBuilder(energyCapacity);
            case 'bootstrapper': return this.generateBootstrapper(energyCapacity);
            case 'filler': return this.generateHauler(energyCapacity);
            case 'remoteharvester': return this.generateHarvester(energyCapacity);
            case 'remotehauler': return this.generateHauler(energyCapacity);
            default: return [WORK, CARRY, MOVE];
        }
    }

    static generateHarvester(energy) {
        // Hardcap: 5 WORK (10 energy/tick, perfect for 3000 source capacity)
        // 1 CARRY (to sit on container and drop), 1 MOVE
        let work = 1, carry = 1, move = 1;
        let cost = 200; // base cost

        // Add up to 4 more WORK parts
        while (cost + 100 <= energy && work < 5) {
            work++;
            cost += 100;
        }

        // Add 1 more MOVE if we are not maxed on WORK and have spare energy
        if (cost + 50 <= energy && move < 2 && work < 5) {
            move++;
            cost += 50;
        }

        return this.buildArray(work, carry, move);
    }

    static generateHauler(energy) {
        // Goal: Maximize CARRY and MOVE in a 2:1 ratio for roads
        let carry = 1, move = 1;
        let cost = 100; // base cost

        // Block cost: 150 (2 CARRY, 1 MOVE)
        while (cost + 150 <= energy && (carry + move + 3) <= 50) {
            carry += 2;
            move += 1;
            cost += 150;
        }

        // Fill remaining with CARRY if possible
        if (cost + 50 <= energy && (carry + move + 1) <= 50) {
            carry += 1;
            cost += 50;
        }

        return this.buildArray(0, carry, move);
    }

    static generateUpgrader(energy) {
        // Goal: Maximize WORK to burn energy, plus proportional CARRY/MOVE
        let work = 1, carry = 1, move = 1;
        let cost = 200; // base cost
        const maxWork = 15; // RCL 8 controller hard cap

        while (cost + 100 <= energy && work < maxWork && (work + carry + move + 1) <= 50) {
            work++;
            cost += 100;

            // Add CARRY/MOVE periodically to support the massive work rate
            if (work % 5 === 0) {
                if (cost + 50 <= energy && (work + carry + move + 1) <= 50) {
                    carry++;
                    cost += 50;
                }
                if (cost + 50 <= energy && (work + carry + move + 1) <= 50) {
                    move++;
                    cost += 50;
                }
            }
        }

        return this.buildArray(work, carry, move);
    }

    static generateBuilder(energy) {
        // Goal: Perfect 1:1:1 balance for versatile construction
        let work = 1, carry = 1, move = 1;
        let cost = 200; // base cost

        while (cost + 200 <= energy && (work + carry + move + 3) <= 50) {
            work++;
            carry++;
            move++;
            cost += 200;
        }

        // Fill remaining with CARRY
        while (cost + 50 <= energy && (work + carry + move + 1) <= 50) {
            carry++;
            cost += 50;
        }

        return this.buildArray(work, carry, move);
    }

    static generateBootstrapper(energy) {
        return [WORK, CARRY, MOVE]; // Minimal emergency logic
    }

    static buildArray(work, carry, move) {
        const body = [];
        for (let i = 0; i < work; i++) body.push(WORK);
        for (let i = 0; i < carry; i++) body.push(CARRY);
        for (let i = 0; i < move; i++) body.push(MOVE);
        return body;
    }
}

module.exports = CreepBodyUtility;
