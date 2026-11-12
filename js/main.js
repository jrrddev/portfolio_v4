/**
 * Jared Daniel Verana Portfolio — Interactive 3D Cartographic & UI Engine
 * Implements:
 * 1. 3D Topographic Terrain Canvas (Three.js WebGL + Instant 3D Projection Engine)
 * 2. 3D Wireframe Field Record Horizon Canvas
 * 3. Spring-Physics Magnetic Compass & Live Survey Telemetry
 * 4. 3D Perspective Tilt on Portrait Plate & Project Frames
 * 5. Scroll-Triggered Telemetry Counters & Reveal Animations
 * 6. Interactive Project Tag Filtering & Certificate Zoom/Pan
 * 7. Field Dossier Command Palette (Ctrl+K / Cmd+K)
 */

(() => {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ==========================================================================
       1. 3D TOPOGRAPHIC TERRAIN ENGINE (Hero Portrait Plate)
       ========================================================================== */
    function initHero3DTopography() {
        const plate = document.querySelector('.portrait-plate');
        const topoContainer = document.querySelector('.portrait-plate .topography');
        if (!plate || !topoContainer) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'topo-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        topoContainer.appendChild(canvas);
        plate.classList.add('has-3d-topo');

        // Add live coordinate readout badge to portrait plate
        const coordsBadge = document.createElement('div');
        coordsBadge.className = 'plate-coords';
        coordsBadge.setAttribute('aria-hidden', 'true');
        coordsBadge.innerHTML = '<span class="coord-dot"></span><span class="coord-text">10.7202° N, 122.5621° E · ELEV 48M</span>';
        plate.appendChild(coordsBadge);
        const coordText = coordsBadge.querySelector('.coord-text');

        // Pointer state for 3D interaction & elevation ripple
        const pointer = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            normX: 0.5,
            normY: 0.5,
            active: false,
            pulseTime: -10
        };

        plate.addEventListener('pointermove', (e) => {
            const rect = plate.getBoundingClientRect();
            pointer.normX = (e.clientX - rect.left) / rect.width;
            pointer.normY = (e.clientY - rect.top) / rect.height;
            pointer.targetX = (pointer.normX - 0.5) * 2;
            pointer.targetY = (pointer.normY - 0.5) * 2;
            pointer.active = true;

            // Update simulated cartographic survey coordinates around Iloilo (10.7202 N, 122.5621 E)
            if (coordText) {
                const lat = (10.7202 - pointer.targetY * 0.014).toFixed(4);
                const lon = (122.5621 + pointer.targetX * 0.014).toFixed(4);
                const elev = Math.round(48 + Math.sin(pointer.normX * 4) * 18 + Math.cos(pointer.normY * 4) * 12);
                coordText.textContent = `${lat}° N, ${lon}° E · ELEV ${elev}M`;
            }
        });

        plate.addEventListener('pointerleave', () => {
            pointer.targetX = 0;
            pointer.targetY = 0;
            pointer.active = false;
            if (coordText) {
                coordText.textContent = '10.7202° N, 122.5621° E · ELEV 48M';
            }
        });

        // Clicking compass or plate triggers a 3D topographic sonar wave
        plate.addEventListener('click', () => {
            pointer.pulseTime = performance.now() * 0.001;
        });

        // Try upgrading to Three.js WebGL 3D Mesh if available, while running crisp 3D Canvas Engine immediately
        let usingThree = false;
        const ctx = canvas.getContext('2d');
        let width = 0;
        let height = 0;
        let dpr = Math.min(window.devicePixelRatio || 1, 2);

        function resizeCanvas() {
            const rect = topoContainer.getBoundingClientRect();
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            if (ctx && !usingThree) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas, { passive: true });

        // Simplex-style layered terrain elevation function
        function getElevation(gx, gz, time) {
            const wave1 = Math.sin(gx * 1.45 + time * 0.45) * Math.cos(gz * 1.25 + time * 0.35) * 22;
            const wave2 = Math.sin(gx * 2.8 - gz * 1.9 + time * 0.25) * 9;
            const ridge = Math.cos((gx * gx + gz * gz) * 0.65 - time * 0.4) * 11;

            // Cursor interactive peak/depression
            const dx = gx - pointer.x * 1.8;
            const dz = gz - pointer.y * 1.5;
            const distSq = dx * dx + dz * dz;
            const cursorPeak = pointer.active ? Math.exp(-distSq * 1.6) * 26 : 0;

            // Sonar pulse wave when clicked
            const elapsedPulse = time - pointer.pulseTime;
            let pulseWave = 0;
            if (elapsedPulse > 0 && elapsedPulse < 3.5) {
                const dist = Math.sqrt(distSq);
                const ring = Math.abs(dist - elapsedPulse * 1.6);
                if (ring < 0.45) {
                    pulseWave = Math.cos((ring / 0.45) * Math.PI * 0.5) * 20 * (1 - elapsedPulse / 3.5);
                }
            }

            return wave1 + wave2 + ridge + cursorPeak + pulseWave;
        }

        // 3D Perspective Projection Engine (runs at 60fps with zero external dependencies)
        const cols = 28;
        const rows = 22;
        const fov = 340;

        function project3D(x, y, z, pitch, yaw) {
            // Rotate around Y axis (yaw)
            const cosY = Math.cos(yaw);
            const sinY = Math.sin(yaw);
            const x1 = x * cosY - z * sinY;
            const z1 = z * cosY + x * sinY;

            // Rotate around X axis (pitch)
            const cosP = Math.cos(pitch);
            const sinP = Math.sin(pitch);
            const y2 = y * cosP - z1 * sinP;
            const z2 = z1 * cosP + y * sinP + 260;

            const scale = fov / Math.max(60, z2);
            return {
                sx: width * 0.5 + x1 * scale,
                sy: height * 0.54 - y2 * scale,
                scale,
                depth: z2
            };
        }

        let animTime = 0;
        function render3DCanvas(now) {
            if (usingThree) return;
            animTime = prefersReducedMotion ? 1.2 : now * 0.001;

            // Smooth spring interpolation for pointer
            pointer.x += (pointer.targetX - pointer.x) * 0.08;
            pointer.y += (pointer.targetY - pointer.y) * 0.08;

            ctx.clearRect(0, 0, width, height);

            const pitch = 0.62 + pointer.y * 0.18;
            const yaw = -0.28 + pointer.x * 0.24 + (prefersReducedMotion ? 0 : Math.sin(animTime * 0.15) * 0.05);

            const spanX = width * 0.95;
            const spanZ = height * 1.05;
            const grid = [];

            for (let r = 0; r < rows; r++) {
                const rowPts = [];
                const nz = (r / (rows - 1) - 0.5) * 2; // -1 to 1
                for (let c = 0; c < cols; c++) {
                    const nx = (c / (cols - 1) - 0.5) * 2; // -1 to 1
                    const wx = nx * (spanX * 0.5);
                    const wz = nz * (spanZ * 0.5);
                    const wy = getElevation(nx * 2, nz * 2, animTime);
                    const proj = project3D(wx, wy, wz, pitch, yaw);
                    proj.wy = wy;
                    proj.nx = nx;
                    proj.nz = nz;
                    rowPts.push(proj);
                }
                grid.push(rowPts);
            }

            // Draw longitudinal terrain ribs (subtle sage lines)
            ctx.lineWidth = 0.85;
            ctx.strokeStyle = 'rgba(72, 92, 80, 0.24)';
            for (let c = 0; c < cols; c += 2) {
                ctx.beginPath();
                for (let r = 0; r < rows; r++) {
                    const pt = grid[r][c];
                    if (r === 0) ctx.moveTo(pt.sx, pt.sy);
                    else ctx.lineTo(pt.sx, pt.sy);
                }
                ctx.stroke();
            }

            // Draw latitudinal 3D topographic contour lines
            for (let r = 0; r < rows; r++) {
                const isMajorContour = r % 4 === 0;
                ctx.beginPath();
                for (let c = 0; c < cols; c++) {
                    const pt = grid[r][c];
                    if (c === 0) ctx.moveTo(pt.sx, pt.sy);
                    else ctx.lineTo(pt.sx, pt.sy);
                }
                if (isMajorContour) {
                    ctx.strokeStyle = 'rgba(25, 60, 50, 0.52)';
                    ctx.lineWidth = 1.35;
                } else {
                    ctx.strokeStyle = 'rgba(25, 60, 50, 0.28)';
                    ctx.lineWidth = 0.9;
                }
                ctx.stroke();
            }

            // Highlight elevation peaks & survey datum vertices in safety orange (#ff713c)
            for (let r = 2; r < rows - 2; r += 3) {
                for (let c = 2; c < cols - 2; c += 4) {
                    const pt = grid[r][c];
                    if (pt.wy > 14) {
                        ctx.fillStyle = '#ff713c';
                        ctx.beginPath();
                        ctx.arc(pt.sx, pt.sy, 2.1 * pt.scale, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Draw 3D interactive cursor survey beacon on the terrain surface
            if (pointer.active) {
                const beaconY = getElevation(pointer.x * 2, pointer.y * 2, animTime);
                const beacon = project3D(
                    pointer.x * (spanX * 0.45),
                    beaconY,
                    pointer.y * (spanZ * 0.45),
                    pitch,
                    yaw
                );

                ctx.strokeStyle = '#ff713c';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(beacon.sx, beacon.sy, 11 * beacon.scale, 0, Math.PI * 2);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(beacon.sx - 16 * beacon.scale, beacon.sy);
                ctx.lineTo(beacon.sx + 16 * beacon.scale, beacon.sy);
                ctx.moveTo(beacon.sx, beacon.sy - 16 * beacon.scale);
                ctx.lineTo(beacon.sx, beacon.sy + 16 * beacon.scale);
                ctx.stroke();
            }

            if (!prefersReducedMotion) {
                requestAnimationFrame(render3DCanvas);
            }
        }

        requestAnimationFrame(render3DCanvas);

        // Optional WebGL Three.js Upgrade (loads asynchronously from CDN if online)
        if (!prefersReducedMotion) {
            import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js')
                .then((THREE) => {
                    const webglCanvas = document.createElement('canvas');
                    webglCanvas.className = 'topo-canvas';
                    webglCanvas.setAttribute('aria-hidden', 'true');

                    const renderer = new THREE.WebGLRenderer({
                        canvas: webglCanvas,
                        alpha: true,
                        antialias: true,
                        powerPreference: 'high-performance'
                    });
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                    renderer.setSize(width, height);

                    const scene = new THREE.Scene();
                    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
                    camera.position.set(0, 72, 115);
                    camera.lookAt(0, -6, 0);

                    const segX = 44;
                    const segZ = 36;
                    const geom = new THREE.PlaneGeometry(175, 145, segX, segZ);
                    geom.rotateX(-Math.PI * 0.5);

                    // Dual-layer mesh: solid paper-green mask + crisp ink wireframe + orange peak points
                    const baseMat = new THREE.MeshBasicMaterial({
                        color: 0xd6dec8,
                        transparent: true,
                        opacity: 0.72,
                        polygonOffset: true,
                        polygonOffsetFactor: 1,
                        polygonOffsetUnits: 1
                    });
                    const baseMesh = new THREE.Mesh(geom, baseMat);
                    scene.add(baseMesh);

                    const wireMat = new THREE.MeshBasicMaterial({
                        color: 0x193c32,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.36
                    });
                    const wireMesh = new THREE.Mesh(geom, wireMat);
                    scene.add(wireMesh);

                    // Orange survey points on vertices
                    const ptsMat = new THREE.PointsMaterial({
                        color: 0xff713c,
                        size: 2.4,
                        transparent: true,
                        opacity: 0.75
                    });
                    const ptsMesh = new THREE.Points(geom, ptsMat);
                    scene.add(ptsMesh);

                    // Swap in WebGL canvas seamlessly
                    topoContainer.replaceChild(webglCanvas, canvas);
                    usingThree = true;

                    window.addEventListener('resize', () => {
                        const rect = topoContainer.getBoundingClientRect();
                        width = Math.max(1, rect.width);
                        height = Math.max(1, rect.height);
                        camera.aspect = width / height;
                        camera.updateProjectionMatrix();
                        renderer.setSize(width, height);
                    }, { passive: true });

                    const posAttr = geom.attributes.position;
                    const origCoords = new Float32Array(posAttr.count * 2);
                    for (let i = 0; i < posAttr.count; i++) {
                        origCoords[i * 2] = posAttr.getX(i);
                        origCoords[i * 2 + 1] = posAttr.getZ(i);
                    }

                    function animateThree(now) {
                        const t = now * 0.001;
                        pointer.x += (pointer.targetX - pointer.x) * 0.07;
                        pointer.y += (pointer.targetY - pointer.y) * 0.07;

                        for (let i = 0; i < posAttr.count; i++) {
                            const x = origCoords[i * 2] / 42;
                            const z = origCoords[i * 2 + 1] / 42;
                            const y = getElevation(x, z, t) * 0.55;
                            posAttr.setY(i, y);
                        }
                        posAttr.needsUpdate = true;

                        camera.position.x = pointer.x * 22 + Math.sin(t * 0.25) * 5;
                        camera.position.y = 70 - pointer.y * 14;
                        camera.lookAt(pointer.x * 6, -4, pointer.y * 4);

                        renderer.render(scene, camera);
                        requestAnimationFrame(animateThree);
                    }
                    requestAnimationFrame(animateThree);
                })
                .catch(() => {
                    // Offline or blocked CDN: built-in 3D projection engine continues running smoothly
                });
        }
    }

    /* ==========================================================================
       2. 3D WIREFRAME FIELD HORIZON (Field Experience Section)
       ========================================================================== */
    function initFieldRecordCanvas() {
        const section = document.querySelector('.field-record');
        if (!section) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'field-record-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        section.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let w = 0;
        let h = 0;

        function resize() {
            const rect = section.getBoundingClientRect();
            w = Math.max(1, rect.width);
            h = Math.max(1, rect.height);
            canvas.width = w;
            canvas.height = h;
        }
        resize();
        window.addEventListener('resize', resize, { passive: true });

        let isVisible = false;
        const obs = new IntersectionObserver((entries) => {
            isVisible = entries[0].isIntersecting;
        }, { threshold: 0.05 });
        obs.observe(section);

        function drawFieldWave(now) {
            if (isVisible || prefersReducedMotion) {
                const t = now * 0.0006;
                ctx.clearRect(0, 0, w, h);
                ctx.strokeStyle = '#b9d1bf';
                ctx.lineWidth = 1;

                const lines = 9;
                for (let l = 0; l < lines; l++) {
                    const yBase = (h / (lines + 1)) * (l + 1);
                    ctx.beginPath();
                    for (let x = 0; x <= w; x += 28) {
                        const nx = x / w;
                        const offset = Math.sin(nx * 5 + t + l * 0.55) * 14 + Math.cos(nx * 9 - t * 0.8) * 6;
                        if (x === 0) ctx.moveTo(x, yBase + offset);
                        else ctx.lineTo(x, yBase + offset);
                    }
                    ctx.stroke();
                }
            }
            if (!prefersReducedMotion) {
                requestAnimationFrame(drawFieldWave);
            }
        }
        requestAnimationFrame(drawFieldWave);
    }

    /* ==========================================================================
       3. MAGNETIC COMPASS & 3D PORTRAIT TILT
       ========================================================================== */
    function initCompassAndTilt() {
        const plate = document.querySelector('.portrait-plate');
        const print = document.querySelector('.portrait-print');
        const compass = document.querySelector('.compass');
        const needle = document.querySelector('.compass-needle');
        if (!plate || !compass || !needle) return;

        // Add live bearing badge below compass
        const bearingBadge = document.createElement('span');
        bearingBadge.className = 'compass-bearing';
        bearingBadge.setAttribute('aria-hidden', 'true');
        bearingBadge.textContent = '012° NNE';
        compass.appendChild(bearingBadge);

        let currentAngle = 12;
        let targetAngle = 12;
        let velocity = 0;

        const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

        window.addEventListener('pointermove', (e) => {
            if (prefersReducedMotion) return;

            // Calculate angle from compass center to cursor
            const rect = compass.getBoundingClientRect();
            const cx = rect.left + rect.width * 0.5;
            const cy = rect.top + rect.height * 0.5;
            const rad = Math.atan2(e.clientY - cy, e.clientX - cx);
            targetAngle = (rad * 180) / Math.PI + 90;
        }, { passive: true });

        // 3D Tilt on Portrait Print when hovering over Portrait Plate
        if (print && !prefersReducedMotion) {
            plate.addEventListener('pointermove', (e) => {
                const rect = plate.getBoundingClientRect();
                const nx = (e.clientX - rect.left) / rect.width - 0.5;
                const ny = (e.clientY - rect.top) / rect.height - 0.5;
                const rotX = -ny * 11;
                const rotY = nx * 13;
                print.style.transform = `rotate(-5deg) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(14px)`;
            });

            plate.addEventListener('pointerleave', () => {
                print.style.transform = 'rotate(-5deg) rotateX(0deg) rotateY(0deg) translateZ(0px)';
            });
        }

        function updateCompassPhysics() {
            // Shortest angular distance
            let diff = ((targetAngle - currentAngle + 540) % 360) - 180;
            velocity = (velocity + diff * 0.085) * 0.78;
            currentAngle += velocity;

            needle.style.transform = `rotate(${currentAngle.toFixed(2)}deg)`;

            // Normalize 0-359 for cardinal readout
            const normDeg = Math.round(((currentAngle % 360) + 360) % 360);
            const dirIndex = Math.round(normDeg / 22.5) % 16;
            bearingBadge.textContent = `${String(normDeg).padStart(3, '0')}° ${cardinals[dirIndex]}`;

            if (!prefersReducedMotion) {
                requestAnimationFrame(updateCompassPhysics);
            }
        }

        if (!prefersReducedMotion) {
            requestAnimationFrame(updateCompassPhysics);
        }
    }

    /* ==========================================================================
       4. TELEMETRY ODOMETERS & SCROLL REVEAL ANIMATIONS
       ========================================================================== */
    function initTelemetryAndReveals() {
        // Scroll progress indicator in sticky header
        const header = document.querySelector('.site-header');
        if (header) {
            const prog = document.createElement('div');
            prog.className = 'scroll-progress';
            prog.setAttribute('aria-hidden', 'true');
            header.appendChild(prog);

            window.addEventListener('scroll', () => {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
                prog.style.transform = `scaleX(${ratio.toFixed(4)})`;
            }, { passive: true });
        }

        // Add subtle visual meter to Research Evaluation Card without changing its text
        const studyResults = document.querySelector('.study-results');
        const studyScore = document.querySelector('.study-score');
        if (studyResults && studyScore) {
            const meter = document.createElement('div');
            meter.className = 'score-meter';
            meter.setAttribute('aria-hidden', 'true');
            meter.innerHTML = '<div class="score-meter-fill"></div>';
            studyScore.insertAdjacentElement('afterend', meter);
        }

        // Animate 80 Hours on site & 4.50 / 5 Study Score on scroll into view
        const hoursEl = document.querySelector('.field-record__hours strong');
        if (hoursEl && !prefersReducedMotion) {
            const targetHours = 80;
            const hoursObs = new IntersectionObserver((entries, obs) => {
                if (!entries[0].isIntersecting) return;
                obs.disconnect();
                const start = performance.now();
                const duration = 1100;
                function tick(now) {
                    const p = Math.min(1, (now - start) / duration);
                    const eased = 1 - Math.pow(1 - p, 3);
                    hoursEl.textContent = String(Math.round(eased * targetHours));
                    if (p < 1) requestAnimationFrame(tick);
                    else hoursEl.textContent = '80';
                }
                requestAnimationFrame(tick);
            }, { threshold: 0.4 });
            hoursObs.observe(hoursEl);
        }

        if (studyScore && studyResults && !prefersReducedMotion) {
            const textNode = studyScore.firstChild;
            const scoreObs = new IntersectionObserver((entries, obs) => {
                if (!entries[0].isIntersecting) return;
                obs.disconnect();
                studyResults.classList.add('is-visible');
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    const start = performance.now();
                    const duration = 1200;
                    function tick(now) {
                        const p = Math.min(1, (now - start) / duration);
                        const eased = 1 - Math.pow(1 - p, 3);
                        textNode.nodeValue = (eased * 4.5).toFixed(2);
                        if (p < 1) requestAnimationFrame(tick);
                        else textNode.nodeValue = '4.50';
                    }
                    requestAnimationFrame(tick);
                }
            }, { threshold: 0.35 });
            scoreObs.observe(studyResults);
        } else if (studyResults) {
            studyResults.classList.add('is-visible');
        }

        // Scroll reveal for cards & ledger rows
        const revealTargets = document.querySelectorAll(
            '.project, .field-record__body, .research-copy, .study-results, .training-record tbody tr'
        );
        revealTargets.forEach((el, idx) => {
            el.classList.add('reveal-item');
            el.style.transitionDelay = `${(idx % 3) * 70}ms`;
        });

        const revealObs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        revealTargets.forEach((el) => revealObs.observe(el));
    }

    /* ==========================================================================
       5. PROJECT FILTERING & 3D CARD INTERACTION
       ========================================================================== */
    function initProjectFilters() {
        const projectsSection = document.querySelector('#projects');
        const projectGrid = document.querySelector('.project-grid');
        const projects = Array.from(document.querySelectorAll('.project'));
        if (!projectsSection || !projectGrid || projects.length === 0) return;

        // Build non-destructive filter bar above project grid
        const controls = document.createElement('div');
        controls.className = 'project-controls';
        controls.innerHTML = `
            <div class="filter-group" role="toolbar" aria-label="Filter projects by technology">
                <button type="button" class="filter-btn is-active" data-filter="all">All <span class="filter-count">${projects.length}</span></button>
                <button type="button" class="filter-btn" data-filter="HTML">HTML / CSS / JS</button>
                <button type="button" class="filter-btn" data-filter="PHP">PHP &amp; MySQL</button>
                <button type="button" class="filter-btn" data-filter="React">React &amp; Next.js</button>
            </div>
        `;
        projectGrid.insertAdjacentElement('beforebegin', controls);

        const filterBtns = Array.from(controls.querySelectorAll('.filter-btn'));

        function applyFilter(tag) {
            filterBtns.forEach((btn) => {
                btn.classList.toggle('is-active', btn.dataset.filter === tag);
            });

            projects.forEach((card) => {
                const cardTags = Array.from(card.querySelectorAll('.tags li')).map((li) => li.textContent.trim());
                const matches = tag === 'all' || cardTags.some((t) => t.toLowerCase().includes(tag.toLowerCase()));
                card.classList.toggle('is-filtered-out', !matches);

                card.querySelectorAll('.tags li').forEach((li) => {
                    li.classList.toggle('is-highlighted', tag !== 'all' && li.textContent.toLowerCase().includes(tag.toLowerCase()));
                });
            });
        }

        filterBtns.forEach((btn) => {
            btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
        });

        // Clicking a tag inside a project card toggles filtering by that tag
        projects.forEach((card) => {
            card.querySelectorAll('.tags li').forEach((tagEl) => {
                tagEl.addEventListener('click', () => {
                    const text = tagEl.textContent.trim();
                    if (text === 'HTML' || text === 'CSS' || text === 'JavaScript') applyFilter('HTML');
                    else if (text === 'PHP' || text === 'MySQL') applyFilter('PHP');
                    else if (text === 'Next.js' || text === 'React' || text === 'TypeScript') applyFilter('React');
                });
            });

            // 3D Multi-Layer Parallax Tilt on Project Cards
            if (!prefersReducedMotion) {
                const frame = card.querySelector('.browser-frame');
                const tags = card.querySelector('.tags');
                card.addEventListener('pointermove', (e) => {
                    const rect = card.getBoundingClientRect();
                    const nx = (e.clientX - rect.left) / rect.width - 0.5;
                    const ny = (e.clientY - rect.top) / rect.height - 0.5;
                    const rx = (-ny * 7).toFixed(2);
                    const ry = (nx * 9).toFixed(2);
                    card.style.transform = `perspective(950px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
                    if (frame) {
                        frame.style.transform = `rotate(0deg) scale(1.035) translate3d(${(nx * 8).toFixed(1)}px, ${(ny * 6).toFixed(1)}px, 18px)`;
                    }
                    if (tags) {
                        tags.style.transform = `translate3d(${(nx * 4).toFixed(1)}px, ${(ny * 3).toFixed(1)}px, 10px)`;
                    }
                });

                card.addEventListener('pointerleave', () => {
                    card.style.transform = '';
                    if (frame) frame.style.transform = '';
                    if (tags) tags.style.transform = '';
                });
            }
        });
    }

    /* ==========================================================================
       5B. 3D ISO/IEC 25010 QUALITY & ARCHITECTURE LATTICE (Research Section)
       ========================================================================== */
    function initResearch3DLattice() {
        const studyResults = document.querySelector('.study-results');
        if (!studyResults) return;

        const widget = document.createElement('div');
        widget.className = 'iso-3d-widget';
        widget.setAttribute('aria-hidden', 'true');
        widget.innerHTML = `
            <div class="iso-3d-header">
                <span>ISO/IEC 25010 3D Mesh</span>
                <span>Drag to rotate ↻</span>
            </div>
            <canvas class="iso-3d-canvas"></canvas>
        `;
        studyResults.appendChild(widget);

        const canvas = widget.querySelector('.iso-3d-canvas');
        const ctx = canvas.getContext('2d');
        let w = 0;
        let h = 175;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        function resize() {
            const rect = canvas.getBoundingClientRect();
            w = Math.max(1, rect.width || 260);
            h = Math.max(1, rect.height || 175);
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize, { passive: true });

        // 6 vertices of an Octahedron representing ISO/IEC 25010 Software Quality Dimensions + Center Core (iFind)
        const nodes = [
            { x: 0, y: 1.05, z: 0, label: 'FUNCTIONAL' },
            { x: 0, y: -1.05, z: 0, label: 'PORTABILITY' },
            { x: 1.05, y: 0, z: 0, label: 'USABILITY' },
            { x: -1.05, y: 0, z: 0, label: 'SECURITY' },
            { x: 0, y: 0, z: 1.05, label: 'RELIABILITY' },
            { x: 0, y: 0, z: -1.05, label: 'MAINTAINABILITY' },
            { x: 0, y: 0, z: 0, label: 'iFIND 4.50', core: true }
        ];

        const edges = [
            [0, 2], [0, 3], [0, 4], [0, 5],
            [1, 2], [1, 3], [1, 4], [1, 5],
            [2, 4], [4, 3], [3, 5], [5, 2],
            [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]
        ];

        let rotX = 0.35;
        let rotY = 0.55;
        let velX = 0.002;
        let velY = 0.007;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        canvas.addEventListener('pointerdown', (e) => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            canvas.setPointerCapture(e.pointerId);
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            velY = dx * 0.012;
            velX = dy * 0.012;
            rotY += velY;
            rotX += velX;
        });

        canvas.addEventListener('pointerup', () => {
            dragging = false;
        });

        let visible = false;
        const obs = new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
        }, { threshold: 0.05 });
        obs.observe(studyResults);

        function renderLattice() {
            if (visible || prefersReducedMotion) {
                if (!dragging && !prefersReducedMotion) {
                    rotY += velY;
                    rotX += velX;
                    velX *= 0.96;
                    velY = velY * 0.98 + 0.00015;
                }

                ctx.clearRect(0, 0, w, h);
                const radius = Math.min(w, h) * 0.35;
                const cosX = Math.cos(rotX);
                const sinX = Math.sin(rotX);
                const cosY = Math.cos(rotY);
                const sinY = Math.sin(rotY);

                const projected = nodes.map((n) => {
                    // Rotate Y
                    const x1 = n.x * cosY - n.z * sinY;
                    const z1 = n.z * cosY + n.x * sinY;
                    // Rotate X
                    const y2 = n.y * cosX - z1 * sinX;
                    const z2 = z1 * cosX + n.y * sinX;

                    const perspective = 3.2 / (3.2 + z2 * 0.75);
                    return {
                        sx: w * 0.5 + x1 * radius * perspective,
                        sy: h * 0.52 - y2 * radius * perspective,
                        z: z2,
                        scale: perspective,
                        label: n.label,
                        core: n.core
                    };
                });

                // Draw edges
                edges.forEach(([a, b]) => {
                    const pa = projected[a];
                    const pb = projected[b];
                    const isCoreEdge = pa.core || pb.core;
                    ctx.beginPath();
                    ctx.moveTo(pa.sx, pa.sy);
                    ctx.lineTo(pb.sx, pb.sy);
                    ctx.strokeStyle = isCoreEdge
                        ? 'rgba(255, 113, 60, 0.38)'
                        : 'rgba(25, 60, 50, 0.35)';
                    ctx.lineWidth = isCoreEdge ? 1 : 1.25;
                    ctx.stroke();
                });

                // Draw vertices & technical labels
                projected.forEach((p) => {
                    ctx.beginPath();
                    const r = (p.core ? 4.5 : 3.2) * p.scale;
                    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
                    ctx.fillStyle = p.core ? '#ff713c' : '#193c32';
                    ctx.fill();

                    if (p.z < 0.55) {
                        ctx.font = `700 ${Math.round(8.5 * p.scale)}px "DM Sans", sans-serif`;
                        ctx.fillStyle = p.core ? '#a74216' : 'rgba(25, 60, 50, 0.85)';
                        ctx.fillText(p.label, p.sx + 6, p.sy + 3);
                    }
                });
            }

            if (!prefersReducedMotion) {
                requestAnimationFrame(renderLattice);
            }
        }
        requestAnimationFrame(renderLattice);
    }

    /* ==========================================================================
       6. CERTIFICATE VIEWER ZOOM & PAN ENHANCEMENT
       ========================================================================== */
    function initCertificateZoom() {
        const viewers = document.querySelectorAll('.certificate-viewer');
        viewers.forEach((viewer) => {
            const toolbar = viewer.querySelector('.certificate-toolbar');
            const closeBtn = viewer.querySelector('.certificate-close');
            const img = viewer.querySelector('img');
            if (!toolbar || !closeBtn || !img) return;

            // Wrap image in a scrollable stage for smooth zoom/pan without altering img attributes
            const stage = document.createElement('div');
            stage.className = 'cert-stage';
            img.parentNode.insertBefore(stage, img);
            stage.appendChild(img);

            // Add Zoom toggle button next to Close button
            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'certificate-actions';
            const zoomBtn = document.createElement('button');
            zoomBtn.type = 'button';
            zoomBtn.className = 'cert-zoom-btn';
            zoomBtn.setAttribute('aria-pressed', 'false');
            zoomBtn.textContent = 'Zoom +';

            closeBtn.parentNode.insertBefore(actionsWrap, closeBtn);
            actionsWrap.appendChild(zoomBtn);
            actionsWrap.appendChild(closeBtn);

            function toggleZoom() {
                const zoomed = viewer.classList.toggle('is-zoomed');
                zoomBtn.setAttribute('aria-pressed', String(zoomed));
                zoomBtn.textContent = zoomed ? 'Reset 1×' : 'Zoom +';
            }

            zoomBtn.addEventListener('click', toggleZoom);
            stage.addEventListener('click', (e) => {
                if (e.target === img || e.target === stage) {
                    toggleZoom();
                }
            });

            viewer.addEventListener('toggle', () => {
                viewer.classList.remove('is-zoomed');
                zoomBtn.setAttribute('aria-pressed', 'false');
                zoomBtn.textContent = 'Zoom +';
            });
        });
    }

    /* ==========================================================================
       7. FIELD DOSSIER COMMAND PALETTE (Ctrl+K / Cmd+K) & TOAST
       ========================================================================== */
    function initCommandPalette() {
        const headerInner = document.querySelector('.header-inner');
        const contactBtn = document.querySelector('.header-contact');
        if (!headerInner || !contactBtn) return;

        // Wrap header contact & command trigger cleanly
        const actions = document.createElement('div');
        actions.className = 'header-actions';
        contactBtn.parentNode.insertBefore(actions, contactBtn);

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'cmd-trigger';
        trigger.setAttribute('aria-label', 'Open quick navigation command palette');
        trigger.innerHTML = '<span>Index</span> <kbd>Ctrl K</kbd>';
        actions.appendChild(trigger);
        actions.appendChild(contactBtn);

        // Toast helper
        const toast = document.createElement('div');
        toast.className = 'field-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);

        let toastTimer = null;
        function showToast(msg) {
            toast.textContent = msg;
            toast.classList.add('is-visible');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
        }

        // Command list items
        const commands = [
            { label: 'Go to Profile & 3D Topography', category: 'Section', action: () => location.hash = '#profile' },
            { label: 'Go to Selected Projects', category: 'Section', action: () => location.hash = '#projects' },
            { label: 'Go to Field Experience (80 Hours)', category: 'Section', action: () => location.hash = '#experience' },
            { label: 'Go to Research: The iFind Study', category: 'Section', action: () => location.hash = '#research' },
            { label: 'Go to Seminars & Trainings', category: 'Section', action: () => location.hash = '#training' },
            { label: 'View Certificate: The Medical City Iloilo', category: 'Credential', action: () => document.getElementById('certificate-immersion')?.showPopover() },
            { label: 'View Certificate: The Human Advantage', category: 'Credential', action: () => document.getElementById('certificate-human-advantage')?.showPopover() },
            { label: 'View Certificate: Code, Conscience, & AI', category: 'Credential', action: () => document.getElementById('certificate-ethical-ai')?.showPopover() },
            { label: 'View Certificate: The DevOps Mindset', category: 'Credential', action: () => document.getElementById('certificate-devops')?.showPopover() },
            {
                label: 'Copy Email: jrrd.dev.projects@gmail.com',
                category: 'Contact',
                action: () => {
                    navigator.clipboard?.writeText('jrrd.dev.projects@gmail.com');
                    showToast('Copied jrrd.dev.projects@gmail.com to clipboard');
                }
            },
            { label: 'Open GitHub (@jrrddev)', category: 'External', action: () => window.open('https://github.com/jrrddev', '_blank', 'noopener') }
        ];

        // Build Command Modal DOM
        const backdrop = document.createElement('div');
        backdrop.className = 'cmd-palette-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        backdrop.setAttribute('aria-label', 'Portfolio Quick Index');
        backdrop.innerHTML = `
            <div class="cmd-palette">
                <div class="cmd-header">
                    <span class="cmd-header-label">Field Index //</span>
                    <input type="text" class="cmd-input" placeholder="Jump to section, certificate, or action..." aria-label="Search commands">
                </div>
                <div class="cmd-list" role="listbox"></div>
                <div class="cmd-footer">
                    <span>↑↓ to navigate · Enter to select</span>
                    <span>ESC to close</span>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);

        const input = backdrop.querySelector('.cmd-input');
        const listEl = backdrop.querySelector('.cmd-list');
        let selectedIdx = 0;
        let filtered = commands;

        function renderList() {
            listEl.innerHTML = '';
            filtered.forEach((cmd, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `cmd-item ${idx === selectedIdx ? 'is-selected' : ''}`;
                btn.innerHTML = `<span>${cmd.label}</span><span class="cmd-item-cat">${cmd.category}</span>`;
                btn.addEventListener('click', () => {
                    closePalette();
                    cmd.action();
                });
                listEl.appendChild(btn);
            });
        }

        function openPalette() {
            backdrop.classList.add('is-open');
            input.value = '';
            filtered = commands;
            selectedIdx = 0;
            renderList();
            setTimeout(() => input.focus(), 20);
        }

        function closePalette() {
            backdrop.classList.remove('is-open');
        }

        trigger.addEventListener('click', openPalette);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closePalette();
        });

        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            filtered = commands.filter((c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
            selectedIdx = 0;
            renderList();
        });

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (backdrop.classList.contains('is-open')) closePalette();
                else openPalette();
            } else if (backdrop.classList.contains('is-open')) {
                if (e.key === 'Escape') {
                    closePalette();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIdx = (selectedIdx + 1) % Math.max(1, filtered.length);
                    renderList();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIdx = (selectedIdx - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length);
                    renderList();
                } else if (e.key === 'Enter' && filtered[selectedIdx]) {
                    e.preventDefault();
                    const cmd = filtered[selectedIdx];
                    closePalette();
                    cmd.action();
                }
            }
        });
    }

    /* ==========================================================================
       8. INTERACTIVE 3D PARTICLE CLOUD FIELD (Floating Dust & Elevation Grids)
       ========================================================================== */
    function init3DParticleCloudField() {
        const canvas = document.createElement('canvas');
        canvas.className = 'particle-cloud-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);

        // Interactive Mode Pill (Auto Scroll-Morph / Locked Elevation Grid / Floating Dust)
        const modePill = document.createElement('button');
        modePill.type = 'button';
        modePill.className = 'particle-mode-pill';
        modePill.dataset.mode = 'auto';
        modePill.setAttribute('aria-label', 'Switch 3D Particle Field mode');
        modePill.innerHTML = '<span class="mode-dot" aria-hidden="true"></span><span class="mode-label">3D Field: Dust ⇄ Grid</span>';
        document.body.appendChild(modePill);

        const modeLabel = modePill.querySelector('.mode-label');
        const modes = ['auto', 'grid', 'dust'];
        let currentModeIdx = 0;

        modePill.addEventListener('click', () => {
            currentModeIdx = (currentModeIdx + 1) % modes.length;
            const mode = modes[currentModeIdx];
            modePill.dataset.mode = mode === 'grid' ? 'grid' : 'auto';
            if (mode === 'auto') modeLabel.textContent = '3D Field: Dust ⇄ Grid';
            else if (mode === 'grid') modeLabel.textContent = '3D Field: Elevation Grid';
            else modeLabel.textContent = '3D Field: Floating Dust';
        });

        const ctx = canvas.getContext('2d');
        let width = window.innerWidth;
        let height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        function resize() {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize, { passive: true });

        // Grid dimensions: 20 cols x 14 rows = 280 3D particles
        const cols = 20;
        const rows = 14;
        const total = cols * rows;
        const fov = 520;

        // Cursor & scroll state
        const mouse = {
            x: width * 0.5,
            y: height * 0.5,
            normX: 0,
            normY: 0,
            smoothX: 0,
            smoothY: 0,
            active: false
        };

        let lastScrollY = window.scrollY;
        let scrollEnergy = 0;
        let gridMorph = 0; // 0 = Floating 3D Dust, 1 = 3D Geometric Elevation Grid

        window.addEventListener('pointermove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            mouse.normX = (e.clientX / width - 0.5) * 2;
            mouse.normY = (e.clientY / height - 0.5) * 2;
            mouse.active = true;
        }, { passive: true });

        window.addEventListener('pointerleave', () => {
            mouse.active = false;
        });

        window.addEventListener('scroll', () => {
            const dy = Math.abs(window.scrollY - lastScrollY);
            lastScrollY = window.scrollY;
            scrollEnergy = Math.min(1.35, scrollEnergy + dy * 0.018);
        }, { passive: true });

        // Initialize 3D particles with both Free-Dust coordinates & Grid-Index identity
        const particles = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                const isOrange = idx % 17 === 0;
                const isCrosshair = idx % 23 === 0;
                particles.push({
                    r,
                    c,
                    // Normalized grid coordinates (-1 to 1)
                    gnx: (c / (cols - 1) - 0.5) * 2,
                    gnz: (r / (rows - 1) - 0.5) * 2,
                    // Free-floating 3D dust coordinates (-1 to 1)
                    dx: (Math.random() - 0.5) * 2.2,
                    dy: (Math.random() - 0.5) * 2.2,
                    dz: (Math.random() - 0.5) * 1.8,
                    // Organic drift velocities
                    vx: (Math.random() - 0.5) * 0.0012,
                    vy: -0.0004 - Math.random() * 0.0009,
                    vz: (Math.random() - 0.5) * 0.001,
                    // Cursor repulsion 3D spring offsets
                    rx: 0,
                    ry: 0,
                    rz: 0,
                    phase: Math.random() * Math.PI * 2,
                    size: isOrange ? 2.4 : 1.35 + Math.random() * 1.15,
                    isOrange,
                    isCrosshair,
                    // Screen projection cache
                    sx: 0,
                    sy: 0,
                    scale: 1,
                    visible: false
                });
            }
        }

        function renderParticleField(now) {
            const t = prefersReducedMotion ? 1.0 : now * 0.001;

            // Decay scroll energy & compute target morph between Dust (0) and Elevation Grid (1)
            scrollEnergy *= 0.92;
            const mode = modes[currentModeIdx];

            // Also check proximity to section boundaries for subtle automatic grid alignment
            const scrollMod = (window.scrollY % Math.max(400, window.innerHeight * 0.85)) / Math.max(400, window.innerHeight * 0.85);
            const boundaryPulse = Math.exp(-Math.pow((scrollMod - 0.5) * 4.5, 2)) * 0.32;

            let targetMorph = 0;
            if (mode === 'grid') {
                targetMorph = 1;
            } else if (mode === 'dust') {
                targetMorph = 0;
            } else {
                targetMorph = Math.min(1, scrollEnergy * 0.95 + boundaryPulse);
            }

            gridMorph += (targetMorph - gridMorph) * 0.075;
            mouse.smoothX += (mouse.normX - mouse.smoothX) * 0.06;
            mouse.smoothY += (mouse.normY - mouse.smoothY) * 0.06;

            ctx.clearRect(0, 0, width, height);

            // 3D rotation angles for the elevation grid & dust volume
            const yaw = mouse.smoothX * 0.22 + Math.sin(t * 0.14) * 0.06;
            const pitch = 0.52 * gridMorph + mouse.smoothY * 0.16;
            const cosY = Math.cos(yaw);
            const sinY = Math.sin(yaw);
            const cosP = Math.cos(pitch);
            const sinP = Math.sin(pitch);

            const spanX = width * 0.62;
            const spanY = height * 0.56;
            const spanZ = 340;
            const scrollOffset = window.scrollY * 0.0018;

            // Update & project all 3D particles
            for (let i = 0; i < total; i++) {
                const p = particles[i];

                // 1. Update free-floating dust position
                if (!prefersReducedMotion) {
                    p.dx += p.vx + Math.sin(t * 0.4 + p.phase) * 0.00045;
                    p.dy += p.vy + Math.cos(t * 0.35 + p.phase) * 0.00035;
                    p.dz += p.vz;

                    // Wrap dust smoothly around volume bounds
                    if (p.dx > 1.15) p.dx = -1.15;
                    if (p.dx < -1.15) p.dx = 1.15;
                    if (p.dy > 1.15) p.dy = -1.15;
                    if (p.dy < -1.15) p.dy = 1.15;
                    if (p.dz > 0.95) p.dz = -0.95;
                    if (p.dz < -0.95) p.dz = 0.95;
                }

                const dustX = p.dx * spanX;
                const dustY = ((p.dy - (scrollOffset % 2.3) + 3.45) % 2.3 - 1.15) * spanY;
                const dustZ = p.dz * spanZ;

                // 2. Compute 3D Topographic Elevation Grid target position
                const gx = p.gnx * (width * 0.52);
                const gz = p.gnz * 290;
                const waveElev =
                    Math.sin(p.gnx * 3.2 + t * 0.7 + scrollOffset) *
                    Math.cos(p.gnz * 2.6 + t * 0.5) * 46 +
                    Math.cos((p.gnx * p.gnx + p.gnz * p.gnz) * 2.2 - t * 0.6) * 22;
                const gy = waveElev - 20;

                // 3. Interpolate between Floating Dust and 3D Elevation Grid
                const wx = dustX + (gx - dustX) * gridMorph + p.rx;
                const wy = dustY + (gy - dustY) * gridMorph + p.ry;
                const wz = dustZ + (gz - dustZ) * gridMorph + p.rz;

                // 4. 3D Camera Rotation (Yaw & Pitch)
                const x1 = wx * cosY - wz * sinY;
                const z1 = wz * cosY + wx * sinY;
                const y2 = wy * cosP - z1 * sinP;
                const z2 = z1 * cosP + wy * sinP + 460;

                if (z2 < 80) {
                    p.visible = false;
                    continue;
                }

                const scale = fov / z2;
                p.sx = width * 0.5 + x1 * scale;
                p.sy = height * 0.52 - y2 * scale;
                p.scale = scale;
                p.visible = p.sx >= -40 && p.sx <= width + 40 && p.sy >= -40 && p.sy <= height + 40;

                // 5. Cursor 3D Repulsion & Vortex Impulse
                if (mouse.active && !prefersReducedMotion) {
                    const dxScreen = p.sx - mouse.x;
                    const dyScreen = p.sy - mouse.y;
                    const distSq = dxScreen * dxScreen + dyScreen * dyScreen;
                    const repelRadius = 135;
                    if (distSq < repelRadius * repelRadius && distSq > 1) {
                        const dist = Math.sqrt(distSq);
                        const force = (1 - dist / repelRadius) * 4.2;
                        p.rx += (dxScreen / dist) * force;
                        p.ry -= (dyScreen / dist) * force;
                        p.rz += force * 2.5;
                    }
                }

                // Spring damping recovery
                p.rx *= 0.88;
                p.ry *= 0.88;
                p.rz *= 0.88;
            }

            // Draw 3D Elevation Grid Contour Lines & Lat/Lon Intersections when morphed
            if (gridMorph > 0.06) {
                const gridAlpha = Math.min(0.32, gridMorph * 0.34);
                ctx.lineWidth = 0.85;

                // Latitudinal contour lines
                for (let r = 0; r < rows; r++) {
                    ctx.beginPath();
                    let started = false;
                    for (let c = 0; c < cols; c++) {
                        const p = particles[r * cols + c];
                        if (!p.visible) continue;
                        if (!started) {
                            ctx.moveTo(p.sx, p.sy);
                            started = true;
                        } else {
                            ctx.lineTo(p.sx, p.sy);
                        }
                    }
                    ctx.strokeStyle = r % 3 === 0
                        ? `rgba(255, 113, 60, ${(gridAlpha * 0.85).toFixed(3)})`
                        : `rgba(72, 92, 80, ${gridAlpha.toFixed(3)})`;
                    ctx.stroke();
                }

                // Longitudinal grid ribs
                ctx.strokeStyle = `rgba(72, 92, 80, ${(gridAlpha * 0.55).toFixed(3)})`;
                for (let c = 0; c < cols; c += 2) {
                    ctx.beginPath();
                    let started = false;
                    for (let r = 0; r < rows; r++) {
                        const p = particles[r * cols + c];
                        if (!p.visible) continue;
                        if (!started) {
                            ctx.moveTo(p.sx, p.sy);
                            started = true;
                        } else {
                            ctx.lineTo(p.sx, p.sy);
                        }
                    }
                    ctx.stroke();
                }
            }

            // Draw Cursor Survey Triangulation Filaments & Particles
            for (let i = 0; i < total; i++) {
                const p = particles[i];
                if (!p.visible) continue;

                // Connect nearby particles to cursor with subtle cartographic triangulation
                if (mouse.active) {
                    const dx = p.sx - mouse.x;
                    const dy = p.sy - mouse.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < 12500) {
                        const alpha = (1 - Math.sqrt(d2) / 112) * 0.28;
                        ctx.strokeStyle = `rgba(255, 113, 60, ${alpha.toFixed(3)})`;
                        ctx.lineWidth = 0.75;
                        ctx.beginPath();
                        ctx.moveTo(p.sx, p.sy);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }

                const radius = Math.max(0.8, p.size * p.scale);
                const depthAlpha = Math.min(0.78, Math.max(0.16, p.scale * 0.68));

                if (p.isCrosshair) {
                    // Draw survey fiducial crosshair (+)
                    const arm = radius * 2.1;
                    ctx.strokeStyle = p.isOrange
                        ? `rgba(255, 113, 60, ${depthAlpha.toFixed(3)})`
                        : `rgba(72, 92, 80, ${depthAlpha.toFixed(3)})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p.sx - arm, p.sy);
                    ctx.lineTo(p.sx + arm, p.sy);
                    ctx.moveTo(p.sx, p.sy - arm);
                    ctx.lineTo(p.sx, p.sy + arm);
                    ctx.stroke();
                } else {
                    ctx.fillStyle = p.isOrange
                        ? `rgba(255, 113, 60, ${(depthAlpha * 1.1).toFixed(3)})`
                        : `rgba(72, 92, 80, ${depthAlpha.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            if (!prefersReducedMotion) {
                requestAnimationFrame(renderParticleField);
            }
        }

        requestAnimationFrame(renderParticleField);
    }

    /* ==========================================================================
       INITIALIZE ALL MODULES ON DOM READY
       ========================================================================== */
    function init() {
        initHero3DTopography();
        initFieldRecordCanvas();
        initCompassAndTilt();
        initTelemetryAndReveals();
        initProjectFilters();
        initResearch3DLattice();
        initCertificateZoom();
        initCommandPalette();
        init3DParticleCloudField();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

