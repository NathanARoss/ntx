export const vsSource =
    `#version 300 es
in vec4 aPosition;
void main(void) {
    gl_Position = aPosition;
}`;

// const carpetFsSource =
//     `precision highp float;
// uniform float uProgress;
// void main(void) {
//     vec2 v = floor(gl_FragCoord.xy * uProgress);

//     vec3 color = vec3(1.0);

//     for (int i = 0; i < 7; ++i) {
//         if (mod(v.x, 3.0) == 1.0 && mod(v.y, 3.0) == 1.0) {
//             color = vec3(0.0);
//         }

//         v.xy = floor(v.xy / 3.0);
//     }

//     gl_FragColor = color.xyzz;
// }`;

export const rayTracerFsSource =
    `#version 300 es
precision highp float;
uniform float uProgress;
uniform vec3 uRayBaseValue, uRayYContrib, uRayXContrib, uRayOrg;

out vec3 outColor;

float gridPattern(vec3 world) {
    world *= 10.0;
    
    float x = floor(world.x) - floor(world.x + fwidth(world.x));
    float y = floor(world.y) - floor(world.y + fwidth(world.y));
    float z = floor(world.z) - floor(world.z + fwidth(world.z));

    if (x != 0.0 || y != 0.0 || z != 0.0) {
        return 1.0;
    } else {
        return 0.0;
    }
}

float sphere(vec3 p, float r) {
    return length(p) - r;
}

float box(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, vec3(0)));
}

float gridCityDistance(vec3 p) {
    float ground = p.y;
    vec2 boxSpace = mod(p.xz + vec2(0.0, 0.8), 1.6) - 0.8;
    float a = box(vec3(boxSpace.x, p.y - 0.5, boxSpace.y), vec3(0.14, 0.5, 0.14));
    vec2 sphereSpace = mod(p.xz + vec2(0.8, 0.0), 1.6) - 0.8;
    float b = sphere(vec3(sphereSpace.x, p.y - 0.1, sphereSpace.y), 0.1);
    return min(ground, min(a, b));
}

// float magicSphereDistance(vec3 p) {
//     float 
// }

float floorDistance(vec3 p) {
    return p.y;
}

void main(void) {
    const float maxAttempts = 8.0;
    const float worldCeiling = 1.0;
    const float epsilon = 1e-3;

    vec3 ray = uRayBaseValue + uRayXContrib * gl_FragCoord.x + uRayYContrib * gl_FragCoord.y;
    ray = normalize(ray);

    //the ray is either inside the world or looking at the world
    if (uRayOrg.y < worldCeiling || ray.y < 0.0) {
        vec3 r;

        if (uRayOrg.y >= worldCeiling) {
            float d = (worldCeiling - uRayOrg.y) / ray.y;
            r.xz = uRayOrg.xz + ray.xz * d;
            r.y = worldCeiling;
        } else {
            r = uRayOrg;
        }

        float tries = maxAttempts;

        float d;
        do {
            r += ray * d;
            d = gridCityDistance(r);
            // d = floorDistance(r);
            tries -= (1.0 / maxAttempts);
        }
        while (d > epsilon && tries > 0.0);
        
        if (d <= epsilon) {
            // const vec3 sky = vec3(0.53, 0.81, 0.92);
            // outColor = tries * sky;

            outColor = vec3(gridPattern(r));
        } else {
            outColor = vec3(0.0);
        }
    } else {
        //the ray cannot hit anything, so skip it
        outColor = vec3(0.0);
    }
}`;

export const sphereTraceFsSource =
    `#version 300 es
precision highp float;
precision mediump sampler3D;
uniform float uProgress;
uniform vec3 uRayBaseValue, uRayYContrib, uRayXContrib, uRayOrg;
uniform sampler3D textureData;

out vec3 outColor;

float gridPattern(vec3 world) {
    float x = floor(world.x) - floor(world.x + fwidth(world.x) * 2.0);
    float y = floor(world.y) - floor(world.y + fwidth(world.y) * 2.0);
    float z = floor(world.z) - floor(world.z + fwidth(world.z) * 2.0);

    if (x != 0.0 || y != 0.0 || z != 0.0) {
        return 1.0;
    } else {
        return 0.0;
    }
}

float checkerboard(vec3 world) {
    return mod(dot(floor(world * 16.0), vec3(1.0)), 2.0);
}

void main(void) {
    const float maxAttempts = 16.0;
    const float epsilon = 1e-3;

    vec3 ray = uRayBaseValue + uRayXContrib * gl_FragCoord.x + uRayYContrib * gl_FragCoord.y;
    ray = normalize(ray) * $SCALE;

    vec3 o = uRayOrg;

    float tries = 1.0;

    float d;
    do {
        d = texture(textureData, o).x + $BIAS;
        o = ray * d + o;
        tries -= 1.0 / maxAttempts;
    }
    while (d > epsilon && tries > 0.0);
    
    if (d <= epsilon) {
        const vec3 sky = vec3(0.53, 0.81, 0.92);
        outColor = sky * tries;

        outColor = vec3(checkerboard(o));
    } else {
        outColor = vec3(0.0);
    }
}`;

export function getRayTracer(gl, sceneID) {
    if (sceneID === 0) {
        return [rayTracerFsSource];
    }

    //gl.MIRRORED_REPEAT, gl.REPEAT
    let sceneSize = [1,1,1];
    let rMode = gl.REPEAT;
    let sMode = gl.REPEAT;
    let tMode = gl.REPEAT;
    let distFunc;

    // if (sceneID === 1) {
        sceneSize = [64, 16, 32];
        distFunc = singleSphereDist;
    // }
    // if (sceneID === 2) {

    // }
    
    const minDim = Math.min(...sceneSize);
    const maxDim = Math.min(...sceneSize);
    const step = 1.0 / maxDim;
    const scale = "vec3(" + sceneSize.map(x => 255/4 / x).join(",") + ")";
    // const bias = -4;
    
    const shader = sphereTraceFsSource.replace(/\$SCALE/g, scale).replace(/\$BIAS/g, "-4.0/255.0");
    
    const data = new Uint8ClampedArray(product(sceneSize));
    let index = 0;
    let z = (maxDim - sceneSize[2]) / (2 * maxDim);
    
    for (let i = 0; i < sceneSize[2]; ++i) {     
        let y = (maxDim - sceneSize[1]) / (2 * maxDim);

        for (let j = 0; j < sceneSize[1]; ++j) {
            let x = (maxDim - sceneSize[0]) / (2 * maxDim);
            
            for (let k = 0; k < sceneSize[0]; ++k) {
                const dist = distFunc(x, y, z);
                data[index++] = dist * minDim * 4 + 4;

                x += step;
            }

            y += step;
        }

        z += step;
    }
    
    // console.log(data);
    
    return [shader, {
        data: data,
        width: sceneSize[0],
        height: sceneSize[1],
        depth: sceneSize[2],
        R: rMode,
        S: sMode,
        T: tMode
    }];
}

function product(arr) {
    return arr.reduce((a, b) => a * b);
}

/* x, y, and z are normalized to be within a [0,1]*[0,1]*[0,1] box.
If the box is non-square, then a subset of the [0,1] range is sampled in a given dimension */
function singleSphereDist(x, y, z) {
    return Math.hypot(x - 0.5, y - 0.5, z - 0.5) - 0.25;
}