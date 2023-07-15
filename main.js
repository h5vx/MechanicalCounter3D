import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js'

class DiskMeter {
    scene
    camera
    renderer
    projector
    gui

    params = {
        numBase: 10,
        rotationSpeed: 8,
        disksCount: 4,
    }

    #controls

    #counterInterval = null;
    #counter = 0;
    #counter3D = new THREE.Group();
    #timeToNextTick = 0
    #maxNumber = 9999

    #textures = {
        2: null,
        8: null,
        10: null,
        16: null,
    }

    #currentTexture = null

    constructor(scene, camera, renderer) {
        this.scene = scene
        this.camera = camera
        this.renderer = renderer
        this.#controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.#controls.enableDamping = true
        this.gui = new GUI()

        this.camera.position.set(0, 0, 25)

        this.#setupListeners()
        this.#setupGUI()
        this.#prepareTextures()

        this.startCounter()

        this.scene.add(this.#counter3D)
    }

    startCounter() {
        if (this.#counterInterval !== null) {
            console.warn("Attempt to start already started counter")
            return
        }

        this.#counterInterval = window.setInterval(() => {
            if (this.#counter === this.#maxNumber) {
                this.#counter = 0
            } else {
                this.#counter += 1
            }

            this.#timeToNextTick = Date.now() + 1000 / this.params.rotationSpeed

        }, 1000 / this.params.rotationSpeed)

        this.#timeToNextTick = Date.now() + 1000 / this.params.rotationSpeed
    }

    stopCounter() {
        window.clearInterval(this.#counterInterval)
        this.#counterInterval = null
    }

    resetCounter() {
        this.#counter = 0
    }

    #setupGUI() {
        this.params.startCounter = () => { this.startCounter() }
        this.params.stopCounter = () => { this.stopCounter() }
        this.params.resetCounter = () => { this.resetCounter() }

        this.gui
            .add(this.params, 'numBase', [2, 8, 10, 16])
            .name("Numeric system base")
            .onChange((n) => {
                this.#maxNumber = Math.pow(n, this.getDisksCount()) - 1
                this.#currentTexture = this.#textures[n]

                for (let disk of this.#counter3D.children) {
                    disk.material.map = this.#currentTexture
                }

                this.#updateCounterLimits(n, this.getDisksCount())
            })

        this.gui
            .add(this.params, 'rotationSpeed', 0, 120)
            .name("Speed")
            .onChange((n) => {
                if (this.#counterInterval !== null) {
                    this.stopCounter()
                    if (n > 0) {
                        this.startCounter()
                    }
                }
            })

        this.gui
            .add(this.params, 'disksCount', 1, 16)
            .name("Number of digits")
            .step(1)
            .onChange((diskCount) => {
                this.#maxNumber = Math.pow(this.params.numBase, diskCount) - 1
                this.#updateCounterLimits(this.params.numBase, diskCount)
            })

        this.gui
            .add(this.params, 'startCounter')
            .name('Start')

        this.gui
            .add(this.params, 'stopCounter')
            .name('Stop')

        this.gui
            .add(this.params, 'resetCounter')
            .name('Reset')
    }

    #updateCounterLimits(numBase, disksCount) {
        const oldCounterDisplay = this.#counter.toString(numBase)
        const newCounterDisplay = oldCounterDisplay.substring(oldCounterDisplay.length - disksCount)
        this.#counter = parseInt(newCounterDisplay, numBase)
    }

    getDisksCount() {
        return this.#counter3D.children.length
    }

    #prepareTextures() {
        const loader = new THREE.TextureLoader()
        this.#textures[2] = loader.load("textures/tex2.png")
        this.#textures[8] = loader.load("textures/tex8.png")
        this.#textures[10] = loader.load("textures/tex10.png")
        this.#textures[16] = loader.load("textures/tex16.png")

        for (let [, texture] of Object.entries(this.#textures)) {
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
            texture.rotation = -(Math.PI / 2)
        }

        this.#currentTexture = this.#textures[this.params.numBase]
    }

    #addDisk() {
        const disk = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 0.225, 39),
            new THREE.MeshBasicMaterial({ map: this.#currentTexture })
        )

        const diskSideGeometry = new THREE.CylinderGeometry(1, 1, 0.001, 39)
        const diskSideMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 })

        const diskSideL = new THREE.Mesh(diskSideGeometry, diskSideMaterial)
        const diskSideR = new THREE.Mesh(diskSideGeometry, diskSideMaterial)

        disk.rotateX(Math.PI / 2)
        disk.rotateZ(Math.PI / 2)

        disk.position.x = this.#counter3D.children.length * 0.25
        this.#counter3D.position.x -= 0.25 / 2

        diskSideL.position.y += 0.115
        diskSideR.position.y -= 0.115

        disk.add(diskSideL)
        disk.add(diskSideR)

        // Reset counter to 0
        for (let exDisk of this.#counter3D.children) {
            exDisk.rotation.x = disk.rotation.x
        }

        this.#counter3D.add(disk)
    }

    #removeDisk() {
        if (this.getDisksCount() == 0) {
            console.warn("removeDisk: attempt to remove disk from empty counter ignored")
            return
        }

        this.#counter3D.remove(this.#counter3D.children[this.getDisksCount() - 1])
        this.#counter3D.position.x += 0.25 / 2
    }

    #setupListeners() {
        window.addEventListener('resize', this.#onResize.bind(this))
    }

    #onResize(e) {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    getDigitValue(index) {
        // Returns integer value of digit of current numeric base at index
        const numRepresentationInCurrentBase = this.#counter.toString(this.params.numBase)
        const zFilled = numRepresentationInCurrentBase.padStart(this.getDisksCount(), '0')
        return parseInt(zFilled[index], this.params.numBase)
    }

    getRightDigitsSum(index) {
        // Returns sum of integer values of digits of current numeric base starting from index
        const numRepresentationInCurrentBase = this.#counter.toString(this.params.numBase)
        const zFilled = numRepresentationInCurrentBase.padStart(this.getDisksCount(), '0')
        let sum = 0

        for (let digit of zFilled.substring(index)) {
            sum += parseInt(digit, this.params.numBase)
        }

        return sum
    }

    renderRotation(disks) {
        const ZERO_ANGLE_EULER = 1.5707963267948972
        const singleNumberAngleRad = (Math.PI * 2) / this.params.numBase
        const currentTime = Date.now()
        const rPercent = (this.#timeToNextTick - currentTime) / (1000 / this.params.rotationSpeed)

        if (currentTime > this.#timeToNextTick) {
            return
        }

        for (const [index, disk] of disks.entries()) {
            const rIndex = disks.length - index - 1
            let digitValue = this.getDigitValue(index)
            disk.rotation.x = ZERO_ANGLE_EULER
            disk.rotateY(singleNumberAngleRad * digitValue)

            let prevDisk = null

            if (index < disks.length - 1) {
                prevDisk = disks[index + 1]
            }

            if (rIndex == 0) {
                disk.rotateY(-singleNumberAngleRad * rPercent)
            } else if (prevDisk && this.getRightDigitsSum(index + 1) == 0) {
                disk.rotateY(-singleNumberAngleRad * rPercent)
            }
        }
    }

    renderDisksCountChange(disks) {
        if (this.params.disksCount !== disks.length) {
            const delta = this.params.disksCount - disks.length

            if (delta < 0) {
                for (let i = delta; i != 0; i++) {
                    this.#removeDisk()
                    return
                }
            }

            if (delta > 0) {
                for (let i = 0; i < delta; i++) {
                    this.#addDisk()
                    return
                }
            }
        }
    }

    animate() {
        this.#animate()
    }

    #animate() {
        const disks = this.#counter3D.children

        this.renderDisksCountChange(disks)
        this.renderRotation(disks)

        this.#controls.update()
    }
}

const scene = new THREE.Scene()
scene.background = new THREE.Color('#EEE')

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
camera.zoom = 4
camera.updateProjectionMatrix()

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)

document.body.appendChild(renderer.domElement)

const dm = new DiskMeter(scene, camera, renderer)

function animate() {
    requestAnimationFrame(animate)
    dm.animate()
    renderer.render(scene, camera)
}

animate()