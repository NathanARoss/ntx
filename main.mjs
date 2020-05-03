import { vsSource, getRayTracer } from "./shaders.mjs";

const debugOutput = document.getElementById("debug");

const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl2", {
    alpha: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false,
});

gl.disable(gl.DEPTH_TEST);

const model = initFullscreenRect(gl);

const [fsSource, scene] = getRayTracer(gl, 1);
const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

const aPosition = gl.getAttribLocation(shaderProgram, 'aPosition');
const uProgress = gl.getUniformLocation(shaderProgram, 'uProgress');
const uRayBaseValue = gl.getUniformLocation(shaderProgram, 'uRayBaseValue');
const uRayYContrib = gl.getUniformLocation(shaderProgram, 'uRayYContrib');
const uRayXContrib = gl.getUniformLocation(shaderProgram, 'uRayXContrib');
const uRayOrg = gl.getUniformLocation(shaderProgram, 'uRayOrg');

//the same model is used for every frame, so configure it once here
gl.useProgram(shaderProgram);
gl.enableVertexAttribArray(aPosition);
gl.bindBuffer(gl.ARRAY_BUFFER, model.buffer);
gl.vertexAttribPointer(aPosition, 2, gl.BYTE, true, 2, 0);

if (scene) {
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_BASE_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAX_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, scene.R);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, scene.S);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, scene.T);
    
    gl.texImage3D(
        gl.TEXTURE_3D,  // target
        0,              // level
        gl.R8,          // internalformat
        scene.width,    // width
        scene.height,   // height
        scene.depth,    // depth
        0,              // border
        gl.RED,         // format
        gl.UNSIGNED_BYTE, // type
        scene.data      // pixel
    );
}


let anyMovementKeyPressed = false;
const playerForward = [1, 0, 0];
const playerRight = [0, 0, 1];
let playerPos = [0, 1, 0];
let hAngle = 0.0;
let vAngle = 0.0;
let aspectRatio = 1.0;

//save the current hAngle and vAngle when a mouse or finger taps down
//as the cursor moves, set the hAngle and vAngle to offsets of these values
let initialHAngle = 0.0;
let initialVAngle = 0.0;

updateCameraPosition(playerPos);

document.body.onresize = function () {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    debugOutput.innerText = canvas.width + "x" + canvas.height;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    aspectRatio = canvas.clientWidth / canvas.clientHeight;
    updateCameraAngle(hAngle, vAngle);
};
document.body.onresize();


function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const typeName = (type == gl.FRAGMENT_SHADER) ? "fragment" : "vertex";
        console.log('Error in %s shader: %s', typeName, gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initShaderProgram(gl, vsSource, fsSource) {
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

let previousFrame = 0;
function drawScene(timestamp) {
    updateGameLogic(timestamp - previousFrame);

    if (!anyMovementKeyPressed) {
        const progress = timestamp / 8000;
        playerPos[0] = progress;
        playerPos[2] = Math.cos(progress);
        updateCameraPosition(playerPos);
    }

    previousFrame = timestamp;

    if (uProgress) {
        const progress = timestamp;
        gl.uniform1f(uProgress, progress);
    }

    gl.drawArrays(model.mode, 0, model.vertexCount);
    requestAnimationFrame(drawScene);
}

function updateGameLogic(delta) {
    const camTurnSpeed = delta / (1000 / 60) * Math.PI / 64;
    const camTravelSpeed = delta / (1000 / 60) * 1e-2;

    if (keysDown.ArrowUp) {
        updateCameraAngle(hAngle, vAngle + camTurnSpeed);
    }

    if (keysDown.ArrowDown) {
        updateCameraAngle(hAngle, vAngle - camTurnSpeed);
    }

    if (keysDown.ArrowLeft) {
        updateCameraAngle(hAngle - camTurnSpeed, vAngle);
    }

    if (keysDown.ArrowRight) {
        updateCameraAngle(hAngle + camTurnSpeed, vAngle);
    }

    if (keysDown.Space) {
        anyMovementKeyPressed = true;
        playerPos[1] += camTravelSpeed;
        updateCameraPosition(playerPos);
    }

    if (keysDown.ShiftLeft) {
        anyMovementKeyPressed = true;
        playerPos[1] -= camTravelSpeed;
        updateCameraPosition(playerPos);
    }

    if (keysDown.KeyW) {
        anyMovementKeyPressed = true;
        playerPos[0] += playerRight[2] * camTravelSpeed;
        playerPos[2] += -playerRight[0] * camTravelSpeed;
        updateCameraPosition(playerPos);
    }

    if (keysDown.KeyS) {
        anyMovementKeyPressed = true;
        playerPos[0] -= playerRight[2] * camTravelSpeed;
        playerPos[2] -= -playerRight[0] * camTravelSpeed;
        updateCameraPosition(playerPos);
    }

    if (keysDown.KeyD) {
        anyMovementKeyPressed = true;
        playerPos[0] += playerRight[0] * camTravelSpeed;
        playerPos[2] += playerRight[2] * camTravelSpeed;
        updateCameraPosition(playerPos);
    }

    if (keysDown.KeyA) {
        anyMovementKeyPressed = true;
        playerPos[0] -= playerRight[0] * camTravelSpeed;
        playerPos[2] -= playerRight[2] * camTravelSpeed;
        updateCameraPosition(playerPos);
    }
}

// function carpetProgress(timestamp) {
//     const time = timestamp / 5000;
//     const remainder = time - Math.floor(time);
//     return Math.pow(3, -remainder);
// }

function updateCameraAngle(newHAngle, newVAngle) {
    hAngle = newHAngle;
    vAngle = Math.min(Math.max(newVAngle, -Math.PI / 2), Math.PI / 2);

    const cosVAngle = Math.cos(vAngle);
    const sinVAngle = Math.sin(vAngle);
    const cosHAngle = Math.cos(hAngle);
    const sinHAngle = Math.sin(hAngle);

    playerForward[0] = cosVAngle * cosHAngle;
    playerForward[1] = sinVAngle;
    playerForward[2] = cosVAngle * sinHAngle;

    playerRight[0] = -sinHAngle;
    playerRight[2] = cosHAngle;

    const up = [
        -sinVAngle * cosHAngle,
        cosVAngle,
        -sinVAngle * sinHAngle,
    ]

    const forward = [];
    const right = [];

    for (let i = 0; i < 3; ++i) {
        forward[i] = playerForward[i] - up[i] - playerRight[i] * aspectRatio;
        right[i] = playerRight[i] * (2.0 / gl.drawingBufferWidth) * aspectRatio;
        up[i] *= 2.0 / gl.drawingBufferHeight;
    }

    if (uRayBaseValue) {
        gl.uniform3fv(uRayBaseValue, forward);
    }

    if (uRayXContrib) {
        gl.uniform3fv(uRayXContrib, right);
    }

    if (uRayYContrib) {
        gl.uniform3fv(uRayYContrib, up);
    }
    updateDebugText();
}

function updateCameraPosition(camPos) {
    if (uRayOrg) {
        gl.uniform3fv(uRayOrg, camPos);
    }
    updateDebugText();
}

function updateDebugText() {
    debugOutput.innerText = `pos: ${playerPos[0].toFixed(2)}, ${playerPos[1].toFixed(2)}, ${playerPos[2].toFixed(2)}\nhAngle: ${hAngle.toFixed(2)}\nvAngle: ${vAngle.toFixed(2)}`
}

let mouseInside;
{
    let touchId = -1;
    let down = false;

    canvas.onmousedown = function (event) {
        onpointerdown(event.x, event.y);
        down = true;
    };

    canvas.onmousemove = function (event) {
        if (down == true)
            onpointermove(event.x, event.y);
    };

    canvas.onmouseup = function (event) {
        onpointerup();
        down = false;
    };

    canvas.onmouseleave = function (event) {
        var e = event.toElement || event.relatedTarget;
        if (down) {
            onpointerup();
        }
        down = false;
        mouseInside = false;
    };

    canvas.onmouseenter = function (event) {
        mouseInside = true;
    };

    canvas.addEventListener("touchstart", function (event) {
        if (touchId === -1) {
            const touch = event.changedTouches[0];
            touchId = touch.identifier;
            onpointerdown(touch.pageX, touch.pageY);
        }
    });

    function existingTouchHandler(event) {
        event.preventDefault();

        for (const touch of event.changedTouches) {
            if (touch.identifier === touchId) {
                switch (event.type) {
                    case "touchmove":
                        onpointermove(touch.pageX, touch.pageY);
                        break;

                    case "touchend":
                    case "touchcancel":
                        onpointerup();
                        touchId = -1;
                        break;
                }
            }
        }
    }

    canvas.addEventListener("touchmove", existingTouchHandler);
    canvas.addEventListener("touchend", existingTouchHandler);
    canvas.addEventListener("touchcancel", existingTouchHandler);
}

document.onwheel = function (event) {
    if (mouseInside) {
        event.preventDefault();

        if (event.deltaY > 0) {
            // ++cameraZoomOut;
        } else {
            // --cameraZoomOut;
        }

        // camera[2] = Math.pow(2, cameraZoomOut / 4);
    }
}

let keysDown = {};
document.onkeydown = function (event) {
    if (!event.repeat) {
        keysDown[event.code] = true;
    }

}

document.onkeyup = function (event) {
    keysDown[event.code] = false;
}

let downX, downY, isCursorDown;
const onpointerdown = (x, y) => {
    downX = x;
    downY = y;
    initialHAngle = hAngle;
    initialVAngle = vAngle;
    isCursorDown = true;
}

const onpointermove = (x, y) => {
    if (isCursorDown) {
        const dx = -(x - downX) / canvas.clientHeight * 2;
        const dy = (y - downY) / canvas.clientHeight * 2;
        updateCameraAngle(initialHAngle + dx, initialVAngle + dy);
    }
}

const onpointerup = () => {
    isCursorDown = false;
}

function initFullscreenRect(gl) {
    const model = new Int8Array([
        -127, -127,
        127, -127,
        -127, 127,
        127, 127,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, model, gl.STATIC_DRAW);

    return { buffer, vertexCount: 4, mode: gl.TRIANGLE_STRIP };
}

drawScene(0);