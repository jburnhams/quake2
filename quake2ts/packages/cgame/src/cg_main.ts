// This file will be the main entry point for the cgame module.
// It will contain the implementation of the CGameExports interface.

import { CGameExports, CGameImports, PlayerClient, PredictionState } from "@quake2ts/shared/dist/cgame/interfaces";
import { Hud } from "./hud";
import { ViewEffects } from "./view-effects";
import { ClientPrediction } from "./prediction";
import { updateCamera, Camera } from "./view";
import { MessageSystem } from "./hud/messages";
import { SubtitleSystem } from "./hud/subtitles";
import { PlayerState } from "@quake2ts/shared";

let cgi: CGameImports;
let hud: Hud;
let viewEffects: ViewEffects;
let prediction: ClientPrediction;
let messageSystem: MessageSystem;
let subtitleSystem: SubtitleSystem;
let camera: Camera;

export function Init(imports: CGameImports): CGameExports {
    cgi = imports;

    return {
        Init: () => {
            hud = new Hud();
            viewEffects = new ViewEffects();
            prediction = new ClientPrediction(cgi.trace);
            messageSystem = new MessageSystem();
            subtitleSystem = new SubtitleSystem();
            camera = new Camera();

            hud.Init(cgi.renderer, cgi.assets);
        },
        Shutdown: () => {},
        DrawActiveFrame: (serverTime: number, stereoView: boolean, demoView: boolean, client: PlayerClient, ps: PlayerState, pred: PredictionState, frameTimeMs: number) => {
            const viewSample = viewEffects.sample(pred, frameTimeMs);
            updateCamera(camera, viewSample);

            hud.Draw(cgi.renderer, ps, client, pred.health, pred.armor, pred.ammo, cgi.renderer.stats, messageSystem, subtitleSystem, serverTime);
        },
    };
}
