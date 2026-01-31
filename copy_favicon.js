
import fs from 'fs';
const src = 'C:/Users/GAMER_VIVI/.gemini/antigravity/brain/fd956a8d-f431-46fb-b4cf-80c7f711efee/favicon_icon_1769719227441.png';
const dest = 'c:/Users/GAMER_VIVI/narrador-de-cuentos/public/favicon.png';

try {
    fs.copyFileSync(src, dest);
    console.log('Success copying generated favicon');
} catch (e) {
    console.error(e);
}
