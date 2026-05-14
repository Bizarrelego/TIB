const fs = require('fs');
let code = fs.readFileSync('src/roles/reserver.js', 'utf8');
code = code.replace("const isOwner = controller.owner && controller.owner.username === myName;\n", "");
code = code.replace("const isReservedByMe = controller.reservation && controller.reservation.username === myName;\n", "");
fs.writeFileSync('src/roles/reserver.js', code);
