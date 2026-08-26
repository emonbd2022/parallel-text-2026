const fs = require('fs');
let content = fs.readFileSync('src/services/centralKeyService.ts', 'utf8');
content = content.replace(`        } else {
            addedCount = keysToSync.length;
        }
        }
      }
    } catch (serverErr) {`,
`        } else {
            addedCount = keysToSync.length;
        }
      }
    } catch (serverErr) {`);
fs.writeFileSync('src/services/centralKeyService.ts', content);
