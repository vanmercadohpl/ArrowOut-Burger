import Phaser from "phaser";

import { adReady } from "../networkPlugin";
import { Base64Manager } from "../utils/Base64Manager";
import { LoadBase64Audio } from "../utils/LoadBase64Audio";
import { INTRO_LIGHT_FRAMES } from "../introLightFrames";
import { heartV2WEBP } from "../../media/images_heartV2.webp.js";
import { handtapV2WEBP } from "../../media/images_handtapV2.webp.js";
import { failSignWEBP } from "../../media/images_fail-sign.webp.js";
import { HPLBlackWEBP } from "../../media/images_HPL-Black.webp.js";
import { HPLWhiteWEBP } from "../../media/images_HPL-White.webp.js";
import { InstallLightWEBP } from "../../media/images_Install_Light.webp.js";
import { winSignWEBP } from "../../media/images_win-sign.webp.js";
import { emojiEmoji01WEBP } from "../../media/images_Emoji_emoji-Emoji_01.webp.js";
import { emojiEmoji02WEBP } from "../../media/images_Emoji_emoji-Emoji_02.webp.js";
import { emojiEmoji03WEBP } from "../../media/images_Emoji_emoji-Emoji_03.webp.js";
import { emojiEmoji04WEBP } from "../../media/images_Emoji_emoji-Emoji_04.webp.js";
import { emojiEmoji05WEBP } from "../../media/images_Emoji_emoji-Emoji_05.webp.js";
import { emojiEmoji06WEBP } from "../../media/images_Emoji_emoji-Emoji_06.webp.js";
import { emojiEmoji07WEBP } from "../../media/images_Emoji_emoji-Emoji_07.webp.js";
import { emojiEmoji08WEBP } from "../../media/images_Emoji_emoji-Emoji_08.webp.js";
import { emojiEmoji09WEBP } from "../../media/images_Emoji_emoji-Emoji_09.webp.js";
import { emojiEmoji10WEBP } from "../../media/images_Emoji_emoji-Emoji_10.webp.js";
import { emojiEmoji11WEBP } from "../../media/images_Emoji_emoji-Emoji_11.webp.js";
import { emojiEmoji12WEBP } from "../../media/images_Emoji_emoji-Emoji_12.webp.js";
import { emojiEmoji13WEBP } from "../../media/images_Emoji_emoji-Emoji_13.webp.js";
import { emojiEmoji14WEBP } from "../../media/images_Emoji_emoji-Emoji_14.webp.js";
import { emojiEmoji15WEBP } from "../../media/images_Emoji_emoji-Emoji_15.webp.js";
import { emojiEmoji16WEBP } from "../../media/images_Emoji_emoji-Emoji_16.webp.js";
import { emojiEmoji17WEBP } from "../../media/images_Emoji_emoji-Emoji_17.webp.js";
import { emojiEmoji18WEBP } from "../../media/images_Emoji_emoji-Emoji_18.webp.js";
import { emojiEmoji19WEBP } from "../../media/images_Emoji_emoji-Emoji_19.webp.js";
import { emojiEmoji20WEBP } from "../../media/images_Emoji_emoji-Emoji_20.webp.js";
import { emojiEmoji21WEBP } from "../../media/images_Emoji_emoji-Emoji_21.webp.js";
import { emojiEmoji22WEBP } from "../../media/images_Emoji_emoji-Emoji_22.webp.js";
import { emojiEmoji23WEBP } from "../../media/images_Emoji_emoji-Emoji_23.webp.js";
import { emojiEmoji24WEBP } from "../../media/images_Emoji_emoji-Emoji_24.webp.js";
import { ErrorMP3 } from "../../media/audio_Error.mp3.js";
import { FailMP3 } from "../../media/audio_Fail.mp3.js";
import { SwooshMP3 } from "../../media/audio_Swoosh.mp3.js";
import { CompletedMP3 } from "../../media/audio_Completed.mp3.js";
import { BGMMP3 } from "../../media/audio_BGM.mp3.js";
import { YummyMP3 } from "../../media/audio_Yummy.mp3.js";
import { emojiLaughMP3 } from "../../media/audio_emoji_laugh.mp3.js";
import { WinSoundMP3 } from "../../media/audio_Win_Sound.mp3.js";

const EMOJI_FRAMES = [
  emojiEmoji01WEBP,
  emojiEmoji02WEBP,
  emojiEmoji03WEBP,
  emojiEmoji04WEBP,
  emojiEmoji05WEBP,
  emojiEmoji06WEBP,
  emojiEmoji07WEBP,
  emojiEmoji08WEBP,
  emojiEmoji09WEBP,
  emojiEmoji10WEBP,
  emojiEmoji11WEBP,
  emojiEmoji12WEBP,
  emojiEmoji13WEBP,
  emojiEmoji14WEBP,
  emojiEmoji15WEBP,
  emojiEmoji16WEBP,
  emojiEmoji17WEBP,
  emojiEmoji18WEBP,
  emojiEmoji19WEBP,
  emojiEmoji20WEBP,
  emojiEmoji21WEBP,
  emojiEmoji22WEBP,
  emojiEmoji23WEBP,
  emojiEmoji24WEBP,
];

export class Preloader extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  init() {
    console.log("%cSCENE::Preloader", "color: #fff; background: #f00;");
  }

  preload() {
    Base64Manager(this, () => this.base64LoaderComplete());

    this.load.image("heartV2", heartV2WEBP);
    this.load.image("handtapV2", handtapV2WEBP);
    this.load.image("failSign", failSignWEBP);
    this.load.image("hplBlack", HPLBlackWEBP);
    this.load.image("hplWhite", HPLWhiteWEBP);
    this.load.image("installLight", InstallLightWEBP);
    this.load.image("winSign", winSignWEBP);

    EMOJI_FRAMES.forEach((frame, index) => {
      this.load.image(`emojiWin${index + 1}`, frame);
    });

    INTRO_LIGHT_FRAMES.forEach((frame) => {
      this.load.image(frame.key, frame.data);
    });

    LoadBase64Audio(this, [
      { key: "error", data: ErrorMP3 },
      { key: "fail", data: FailMP3 },
      { key: "swoosh", data: SwooshMP3 },
      { key: "completed", data: CompletedMP3 },
      { key: "bgm", data: BGMMP3 },
      { key: "yummy", data: YummyMP3 },
      { key: "emojiLaugh", data: emojiLaughMP3 },
      { key: "winSound", data: WinSoundMP3 },
    ]);
  }

  create() {
    // Wait for base64 audio decoding before starting the game.
  }

  base64LoaderComplete() {
    adReady();
    this.scene.start("Game");
  }
}
