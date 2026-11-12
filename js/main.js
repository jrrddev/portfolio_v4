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

        // Mobile single-row left-to-right marquee for .toolkit
        const toolkitList = document.querySelector('.toolkit-inner ul');
        if (toolkitList && !toolkitList.querySelector('.toolkit-clone')) {
            const origItems = Array.from(toolkitList.children);
            origItems.forEach((li) => {
                const clone = li.cloneNode(true);
                clone.classList.add('toolkit-clone');
                clone.setAttribute('aria-hidden', 'true');
                toolkitList.appendChild(clone);
            });
        }
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

        // Assign unique view-transition-name to each project card for smooth View Transitions morphing
        projects.forEach((card, idx) => {
            card.style.viewTransitionName = `project-card-${idx}`;
        });

        function updateFilterDOM(tag) {
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

        function applyFilter(tag) {
            if (typeof document.startViewTransition === 'function' && !prefersReducedMotion) {
                document.startViewTransition(() => updateFilterDOM(tag));
            } else {
                updateFilterDOM(tag);
            }
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
        });
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

        // #6: Native View Transitions on Certificate Modal open/close triggers
        if (typeof document.startViewTransition === 'function' && !prefersReducedMotion) {
            document.querySelectorAll('[popovertarget^="certificate-"]').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const targetId = btn.getAttribute('popovertarget');
                    const viewer = targetId ? document.getElementById(targetId) : null;
                    if (!viewer) return;

                    e.preventDefault();
                    const action = btn.getAttribute('popovertargetaction') || 'toggle';
                    const isOpen = viewer.matches(':popover-open');

                    viewer.style.viewTransitionName = 'cert-modal';
                    const transition = document.startViewTransition(() => {
                        if (action === 'hide' || isOpen) {
                            viewer.hidePopover();
                        } else {
                            viewer.showPopover();
                        }
                    });
                    transition.finished.finally(() => {
                        viewer.style.viewTransitionName = '';
                    });
                });
            });
        }
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
       8. LENIS SMOOTH INERTIA SCROLLING + SCROLL-VELOCITY TYPOGRAPHY SKEW
       ========================================================================== */
    function initLenisAndVelocitySkew() {
        if (prefersReducedMotion) return;

        const root = document.documentElement;
        let lenisInstance = null;
        let lastScrollY = window.scrollY;
        let lastTime = performance.now();
        let rawVelocity = 0;

        // Spring physics state for typography skew & optical stretch
        let currentSkew = 0;
        let skewVelocity = 0;
        let currentShear = 0;
        let currentStretch = 1;

        function setupLenis(LenisCtor) {
            if (!LenisCtor || lenisInstance) return;

            root.classList.add('lenis', 'lenis-smooth');
            lenisInstance = new LenisCtor({
                lerp: 0.088,
                smoothWheel: true,
                wheelMultiplier: 1.0,
                touchMultiplier: 1.5
            });

            // Prevent Lenis from hijacking scroll inside scrollable popovers/command list
            document.querySelectorAll('.cert-stage, .cmd-list').forEach((el) => {
                el.setAttribute('data-lenis-prevent', '');
            });

            // Intercept internal anchor links for silky Lenis scrollTo transitions
            document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
                anchor.addEventListener('click', (e) => {
                    const href = anchor.getAttribute('href');
                    if (!href || href === '#') return;
                    const target = href === '#top' ? 0 : document.querySelector(href);
                    if (target !== null) {
                        e.preventDefault();
                        lenisInstance.scrollTo(target, {
                            offset: href === '#top' ? 0 : -74,
                            duration: 1.15
                        });
                        history.pushState(null, '', href);
                    }
                });
            });
        }

        // Initialize immediately if UMD script loaded, otherwise fallback to ESM import
        if (typeof window.Lenis === 'function') {
            setupLenis(window.Lenis);
        } else {
            import('https://cdn.jsdelivr.net/npm/lenis@1.1.20/+esm')
                .then((mod) => setupLenis(mod.default || mod.Lenis))
                .catch(() => {});
        }

        // Track native scroll velocity as fallback if offline
        window.addEventListener('scroll', () => {
            if (lenisInstance) return;
            const now = performance.now();
            const dt = Math.max(8, now - lastTime);
            const dy = window.scrollY - lastScrollY;
            rawVelocity = (dy / dt) * 16.67;
            lastScrollY = window.scrollY;
            lastTime = now;
        }, { passive: true });

        // Spring-damped RAF loop for Scroll-Velocity Typography Skew & Lenis tick
        function rafLoop(time) {
            if (lenisInstance) {
                lenisInstance.raf(time);
                rawVelocity = lenisInstance.velocity || 0;
            } else {
                rawVelocity *= 0.86;
            }

            // Target skew (-4.2deg to +4.2deg) & vertical optical stretch
            const targetSkew = Math.max(-4.2, Math.min(4.2, rawVelocity * 0.12));
            const targetShear = Math.max(-1.8, Math.min(1.8, -rawVelocity * 0.05));
            const targetStretch = 1 + Math.min(0.055, Math.abs(rawVelocity) * 0.0014);

            // Spring physics with subtle elastic rebound for skew
            const force = (targetSkew - currentSkew) * 0.16;
            skewVelocity = (skewVelocity + force) * 0.76;
            currentSkew += skewVelocity;

            currentShear += (targetShear - currentShear) * 0.15;
            currentStretch += (targetStretch - currentStretch) * 0.15;

            if (Math.abs(currentSkew) < 0.004 && Math.abs(skewVelocity) < 0.004) {
                currentSkew = 0;
                skewVelocity = 0;
            }
            if (Math.abs(currentShear) < 0.004) currentShear = 0;
            if (Math.abs(currentStretch - 1) < 0.0004) currentStretch = 1;

            root.style.setProperty('--scroll-skew', `${currentSkew.toFixed(3)}deg`);
            root.style.setProperty('--scroll-shear', `${currentShear.toFixed(3)}deg`);
            root.style.setProperty('--scroll-stretch', currentStretch.toFixed(4));

            requestAnimationFrame(rafLoop);
        }
        requestAnimationFrame(rafLoop);
    }

    /* ==========================================================================
       9. TACTILE MICRO-INTERACTIONS (Magnetic Buttons/Links & Drafting Cursor)
       ========================================================================== */
    function initTactileMicroInteractions() {
        if (prefersReducedMotion) return;

        // 1. Elastic Magnetic Pull on Interactive Buttons & Links
        const magneticSelectors = [
            '.button',
            '.header-contact',
            '.brand',
            '.cmd-trigger',
            '.filter-btn',
            '.project-link',
            '.text-link',
            '.record-link',
            '.certificate-close',
            '.cert-zoom-btn',
            '.socials a',
            '.colophon a[href="#top"]'
        ].join(', ');

        const magneticElements = document.querySelectorAll(magneticSelectors);
        magneticElements.forEach((el) => {
            el.classList.add('is-magnetic');
            const childSpan = el.querySelector('span[aria-hidden="true"]');

            el.addEventListener('pointerenter', () => {
                el.classList.add('is-pulling');
            });

            el.addEventListener('pointermove', (e) => {
                const rect = el.getBoundingClientRect();
                const cx = rect.left + rect.width * 0.5;
                const cy = rect.top + rect.height * 0.5;
                const dx = (e.clientX - cx) * 0.24;
                const dy = (e.clientY - cy) * 0.32;

                const maxPullX = Math.min(8, rect.width * 0.12);
                const maxPullY = Math.min(6, rect.height * 0.22);
                const pullX = Math.max(-maxPullX, Math.min(maxPullX, dx));
                const pullY = Math.max(-maxPullY, Math.min(maxPullY, dy));

                el.style.transform = `translate3d(${pullX.toFixed(2)}px, ${pullY.toFixed(2)}px, 0)`;
                if (childSpan) {
                    childSpan.style.transform = `translate3d(${(pullX * 0.45).toFixed(2)}px, ${(pullY * 0.45).toFixed(2)}px, 0)`;
                }
            });

            el.addEventListener('pointerleave', () => {
                el.classList.remove('is-pulling');
                el.style.transform = '';
                if (childSpan) {
                    childSpan.style.transform = '';
                }
            });
        });

        // 2. Precision Drafting Crosshair Cursor Follower (Desktop Fine Pointer)
        if (window.matchMedia('(pointer: fine)').matches) {
            const cursor = document.createElement('div');
            cursor.className = 'drafting-cursor';
            cursor.setAttribute('aria-hidden', 'true');
            document.body.appendChild(cursor);

            let mouseX = -100;
            let mouseY = -100;
            let curX = -100;
            let curY = -100;
            let active = false;

            const interactiveHoverSelector = 'a, button, summary, input, .tags li, .compass';

            window.addEventListener('pointermove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
                if (!active) {
                    active = true;
                    curX = mouseX;
                    curY = mouseY;
                    cursor.classList.add('is-active');
                }
                const isHover = Boolean(e.target && e.target.closest && e.target.closest(interactiveHoverSelector));
                cursor.classList.toggle('is-hovering', isHover);
            }, { passive: true });

            window.addEventListener('pointerdown', () => {
                cursor.classList.add('is-pressed');
            }, { passive: true });

            window.addEventListener('pointerup', () => {
                cursor.classList.remove('is-pressed');
            }, { passive: true });

            document.addEventListener('mouseleave', () => {
                cursor.classList.remove('is-active');
                active = false;
            });

            function updateCursor() {
                if (active) {
                    curX += (mouseX - curX) * 0.22;
                    curY += (mouseY - curY) * 0.22;
                    cursor.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
                }
                requestAnimationFrame(updateCursor);
            }
            requestAnimationFrame(updateCursor);
        }
    }

    /* ==========================================================================
       10. ATMOSPHERIC POLISH (Archival Paper Grain + Chameleon Sticky Header)
       ========================================================================== */
    function initAtmosphericPolish() {
        // #4: Subtle Archival Paper Grain + Ambient Desk-Light Overlay
        const atmosphere = document.createElement('div');
        atmosphere.className = 'paper-atmosphere';
        atmosphere.setAttribute('aria-hidden', 'true');
        document.body.appendChild(atmosphere);

        if (!prefersReducedMotion) {
            window.addEventListener('pointermove', (e) => {
                const xPct = ((e.clientX / window.innerWidth) * 100).toFixed(1);
                const yPct = ((e.clientY / window.innerHeight) * 100).toFixed(1);
                atmosphere.style.setProperty('--light-x', `${xPct}%`);
                atmosphere.style.setProperty('--light-y', `${yPct}%`);
            }, { passive: true });
        }

        // #7: Chameleon Dark / Light Sticky Header over Dark Sections (.toolkit, #experience, #contact)
        const header = document.querySelector('.site-header');
        const darkSections = Array.from(document.querySelectorAll('.toolkit, .field-record, .footer'));
        if (!header || darkSections.length === 0) return;

        let ticking = false;
        function updateHeaderTheme() {
            ticking = false;
            const headerRect = header.getBoundingClientRect();
            const probeY = headerRect.top + headerRect.height * 0.55;

            const overDark = darkSections.some((sec) => {
                const r = sec.getBoundingClientRect();
                return r.top <= probeY && r.bottom >= probeY;
            });

            header.classList.toggle('is-dark-surface', overDark);
        }

        updateHeaderTheme();
        window.addEventListener('scroll', () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(updateHeaderTheme);
            }
        }, { passive: true });
        window.addEventListener('resize', updateHeaderTheme, { passive: true });
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
        initCertificateZoom();
        initCommandPalette();
        initLenisAndVelocitySkew();
        initTactileMicroInteractions();
        initAtmosphericPolish();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

