const font = [
	0xf0, 0x90, 0x90, 0x90, 0xf0, 0x20, 0x60, 0x20, 0x20, 0x70, 0xf0, 0x10,
	0xf0, 0x80, 0xf0, 0xf0, 0x10, 0xf0, 0x10, 0xf0, 0x90, 0x90, 0xf0, 0x10,
	0x10, 0xf0, 0x80, 0xf0, 0x10, 0xf0, 0xf0, 0x80, 0xf0, 0x90, 0xf0, 0xf0,
	0x10, 0x20, 0x40, 0x40, 0xf0, 0x90, 0xf0, 0x90, 0xf0, 0xf0, 0x90, 0xf0,
	0x10, 0xf0, 0xf0, 0x90, 0xf0, 0x90, 0x90, 0xe0, 0x90, 0xe0, 0x90, 0xe0,
	0xf0, 0x80, 0x80, 0x80, 0xf0, 0xe0, 0x90, 0x90, 0x90, 0xe0, 0xf0, 0x80,
	0xf0, 0x80, 0xf0, 0xf0, 0x80, 0xf0, 0x80, 0x80,
];

class Chip8 {
	// 4k RAM from 0x000 to 0xFFF
	// The first 512 bytes (0x1FF) are reserved for the original interpreter
	ram: Uint8Array;

	// 16 general purpose 8bit registers V[0-F]
	// VF register is special and should not be used as it is used as a flag for instructions.
	registers: Uint8Array;

	// The stack is a 16 16bit values array, that stores the address of a subroutine, chip8 allows
	// up to 16 levels of nested subroutines.
	stack: Uint16Array;

	// Stores the graphic to display. Each byte can only be on or off since
	// only two colors can be represented.
	display: Uint8Array;

	// 16-key hexadecimal keypad 0x0 => 0xF
	keypad: Uint8Array;

	// 1 16bit register called I, used to store memory addresses. Max memory is 0xFFF (4095)
	// so we only care about the rightmost 12 bits.
	index: number;

	// 8bit timers that handle delay and sound.
	delay: number;
	sound: number;

	// Program Counter that stores the currently executing adress
	// First 512 bytes of memory are reserved so just start it here.
	pc: number;

	// stack pointer that points to the topmost level of the stack
	sp: number;

	opcode: number;

	constructor() {
		/**
		 * Add key listeners.
		 * Chip has values from 0x0 to 0xF, arranged in a keypad that we map
		 * to a keyboard friendly equivalent
		 *
		 * 123C ==> 1234
		 * 456D ==> QWER
		 * 789E ==> ASDF
		 * A0BF ==> ZXCV
		 *
		 * This diagram is based on a qwerty layout, but since I used scancodes
		 * it doesn't matter which layout you use the phyisical position
		 * is always the same
		 */

		const keydown = (e: KeyboardEvent) => {
			switch (e.code) {
				case "Digit1":
					this.keypad[0x1] = 1;
					break;
				case "Digit2":
					this.keypad[0x2] = 1;
					break;
				case "Digit3":
					this.keypad[0x3] = 1;
					break;
				case "Digit4":
					this.keypad[0xc] = 1;
					break;
				case "KeyQ":
					this.keypad[0x4] = 1;
					break;
				case "KeyW":
					this.keypad[0x5] = 1;
					break;
				case "KeyE":
					this.keypad[0x6] = 1;
					break;
				case "KeyR":
					this.keypad[0xd] = 1;
					break;
				case "KeyA":
					this.keypad[0x7] = 1;
					break;
				case "KeyS":
					this.keypad[0x8] = 1;
					break;
				case "KeyD":
					this.keypad[0x9] = 1;
					break;
				case "KeyF":
					this.keypad[0xe] = 1;
					break;
				case "KeyZ":
					this.keypad[0xa] = 1;
					break;
				case "KeyX":
					this.keypad[0x0] = 1;
					break;
				case "KeyC":
					this.keypad[0xb] = 1;
					break;
				case "KeyV":
					this.keypad[0xf] = 1;
					break;
				default:
					return;
			}
		};

		const keyup = (e: KeyboardEvent) => {
			switch (e.code) {
				case "Digit1":
					this.keypad[0x1] = 0;
					break;
				case "Digit2":
					this.keypad[0x2] = 0;
					break;
				case "Digit3":
					this.keypad[0x3] = 0;
					break;
				case "Digit4":
					this.keypad[0xc] = 0;
					break;
				case "KeyQ":
					this.keypad[0x4] = 0;
					break;
				case "KeyW":
					this.keypad[0x5] = 0;
					break;
				case "KeyE":
					this.keypad[0x6] = 0;
					break;
				case "KeyR":
					this.keypad[0xd] = 0;
					break;
				case "KeyA":
					this.keypad[0x7] = 0;
					break;
				case "KeyS":
					this.keypad[0x8] = 0;
					break;
				case "KeyD":
					this.keypad[0x9] = 0;
					break;
				case "KeyF":
					this.keypad[0xe] = 0;
					break;
				case "KeyZ":
					this.keypad[0xa] = 0;
					break;
				case "KeyX":
					this.keypad[0x0] = 0;
					break;
				case "KeyC":
					this.keypad[0xb] = 0;
					break;
				case "KeyV":
					this.keypad[0xf] = 0;
					break;
				default:
					return;
			}
		};

		window.addEventListener("keydown", keydown, { passive: true });
		window.addEventListener("keyup", keyup, { passive: true });
	}

	init() {
		this.ram = new Uint8Array(4096);
		this.registers = new Uint8Array(16);
		this.stack = new Uint16Array(16);
		this.display = new Uint8Array(64 * 32);
		this.keypad = new Uint8Array(16);
		this.index = 0 & 0xffff;
		this.delay = 0 & 0xff;
		this.sound = 0 & 0xff;
		this.pc = 0x200 & 0xffff;
		this.sp = 0 & 0xff;
		this.opcode = 0 & 0xffff;

		// Load font into memory
		// Convention seems to be to start at address 0x50 and end at 0x9F;
		for (let i = 0; i < font.length; i++) {
			this.ram[i + 0x50] = font[i];
		}
	}

	async load(path: string, cb: Function) {
		const blob = await fetch(path).then((r) => r.blob());
		const arrayBuffer = await blob.arrayBuffer();

		const data = new Uint8Array(arrayBuffer);
		this.init();
		cb();

		// Load into memory
		for (let i = 0; i < data.length; i++) {
			this.ram[i + 0x200] = data[i];
		}
	}

	push(value: number) {
		for (let i = this.stack.length - 1; i > 0; i--) {
			this.stack[i] = this.stack[i - 1];
		}

		this.stack[0] = value;
	}

	pop() {
		for (let i = 1; i < this.stack.length; i++) {
			this.stack[i - 1] = this.stack[i];
			this.stack[i] = 0;
		}
	}

	cycle() {
		/**
		 * Opcodes are 2 bytes, eg. 0xF033. Our memory is 8 bits
		 * so to get an opcode we need to fetch 2 consecutive values.
		 * Since it's big endian we shift the first byte by 8bits and
		 * bitwise OR the result with the second (least significant byte)
		 * which is already in the right position.
		 *
		 * this.ram[this.pc] = 0xF0;
		 * this.ram[this.pc] = 0x33;
		 * 0xF0 << 8 = 0xF000
		 * 0xF000 | 0x33 (0x0033) = 0xF033;
		 */
		this.opcode = (this.ram[this.pc] << 8) | this.ram[this.pc + 1];

		this.pc += 2;

		// Decoding opcodes
		switch (this.opcode & 0xf000) {
			// Clear the screen
			case 0x00e0: {
				for (let i = 0; i < this.display.length; i++) {
					this.display[i] = 0;
				}
				break;
			}
			case 0x00ee: {
				console.log("A");
				break;
			}
			// Jump to adress NNN
			case 0x1000: {
				this.pc = this.opcode & 0x0fff;
				break;
			}
			// Set Register value
			case 0x6000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const nn = this.opcode & 0x00ff;
				this.registers[x] = nn;
				break;
			}
			// Add to register
			case 0x7000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const nn = this.opcode & 0x00ff;
				this.registers[x] += nn;
				break;
			}
			case 0xa000: {
				this.index = this.opcode & 0x0fff;
				break;
			}
			// Draw
			case 0xd000: {
				const x = this.registers[(this.opcode & 0x0f00) >> 8];
				const y = this.registers[(this.opcode & 0x00f0) >> 4];
				const height = this.opcode & 0x000f;

				this.registers[15] = 0;

				for (let i = 0; i < height; i++) {
					const value = this.ram[this.index + i];

					// Always 8 width sprites
					for (let j = 0; j < 8; j++) {
						// Will create a mask for every single bit based on j
						const mask = 0x80 >> j;

						if ((value & mask) !== 0) {
							// Checking if I have to flip a bit
							const dIndex = x + j + (y + i) * 64;
							if (this.display[dIndex] === 1) {
								this.registers[15] = 1;
							}
							this.display[dIndex] ^= 1;
						}
					}
				}

				break;
			}
			default:
				break;
		}

		if (this.delay > 0) {
			this.delay--;
		}

		if (this.sound > 0) {
			this.sound--;
		}
	}

	random() {
		// need a uint8 so 0-255
		return Math.floor(Math.random() * 256);
	}
}

class Renderer {
	scale: number;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	imageData: ImageData;

	constructor(scale: number) {
		this.scale = scale;
		this.canvas = document.createElement("canvas");
		this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
		this.resize();
	}

	resize() {
		const w = 64 * this.scale;
		const h = 32 * this.scale;
		this.canvas.width = w;
		this.canvas.height = h;
		this.canvas.style.width = `${w}px`;
		this.canvas.style.height = `${h}px`;

		this.ctx.clearRect(0, 0, w, h);
		this.imageData = this.ctx.getImageData(0, 0, w, h);
	}

	draw(display: Uint8Array) {
		const w = 64 * this.scale;
		const h = 32 * this.scale;

		for (let i = 0; i < w; i++) {
			for (let j = 0; j < h; j++) {
				const x = Math.floor((i / w) * 64);
				const y = Math.floor((j / h) * 32);

				// Display index
				const ind = Math.floor(x + y * 64);
				const color = display[ind] * 255;

				// ImageData index
				const ind2 = Math.floor(i * 4 + j * w * 4);
				this.imageData.data[ind2] = color;
				this.imageData.data[ind2 + 1] = color;
				this.imageData.data[ind2 + 2] = color;
				this.imageData.data[ind2 + 3] = 255;
			}
		}
		this.ctx.putImageData(this.imageData, 0, 0);
	}
}

const chip8 = new Chip8();

const renderer = new Renderer(12);
const app = document.getElementById("app") as HTMLElement;
app.appendChild(renderer.canvas);

const delay = 1000 / 60;

let t = 0;
function main(n = 0) {
	const dt = n - t;
	if (dt > delay) {
		t = n;
		chip8.cycle();
		renderer.draw(chip8.display);
	}
	window.requestAnimationFrame(main);
}

chip8.load("/test_opcode.ch8", main);
