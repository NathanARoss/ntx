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
    float x = floor(world.x) - floor(world.x + fwidth(world.x) * 2.0);
    float y = floor(world.y) - floor(world.y + fwidth(world.y) * 2.0);
    float z = floor(world.z) - floor(world.z + fwidth(world.z) * 2.0);

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
    float ground = p.y + 0.5;
    vec2 boxSpace = mod(p.xz + vec2(0.0, 8.0), 16.0) - 8.0;
    float a = box(vec3(boxSpace.x, p.y - 10.0, boxSpace.y), vec3(1.4, 10.0, 1.4));
    vec2 sphereSpace = mod(p.xz + vec2(8.0, 0.0), 16.0) - 8.0;
    float b = sphere(vec3(sphereSpace.x, p.y - 1.0, sphereSpace.y), 1.0);
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
    const float worldCeiling = 20.0;

    vec3 ray = uRayBaseValue + uRayXContrib * gl_FragCoord.x + uRayYContrib * gl_FragCoord.y;
    ray = normalize(ray);

    //the ray is either inside the world or looking at the world
    if (uRayOrg.y < worldCeiling || ray.y < 0.0) {
        vec3 r;

        if (uRayOrg.y >= worldCeiling) {
            float d = (worldCeiling - uRayOrg.y) / ray.y;
            r.xz = uRayOrg.xz + (ray.xz * d);
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
            tries -= 1.0;
        }
        while (d > 0.1 && tries > 0.0);
        
        if (d <= 0.5) {
            // const vec3 sky = vec3(0.53, 0.81, 0.92);
            // outColor = (tries / maxAttempts) * sky;

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

void main(void) {
    const float maxAttempts = 16.0;

    vec3 ray = uRayBaseValue + uRayXContrib * gl_FragCoord.x + uRayYContrib * gl_FragCoord.y;
    ray = normalize(ray);

    vec3 o = uRayOrg;

    float tries = maxAttempts;

    float d;
    do {
        d = texture(textureData, o).x - 0.4;
        o += ray * d;
        tries -= 1.0;
    }
    while (d > 1e-4 && tries > 0.0);
    
    if (d <= 1e-4) {
        const vec3 sky = vec3(0.53, 0.81, 0.92);
        outColor = (tries / maxAttempts) * sky;

        // outColor = vec3(gridPattern(o));
    } else {
        outColor = vec3(0.0);
    }
}`;