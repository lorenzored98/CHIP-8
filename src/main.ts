// Chip8 interpreter fully working.
// Haven't implemented the web audio api to actually hear the sound

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
		// https://en.wikipedia.org/wiki/CHIP-8#Opcode_table
		switch (this.opcode & 0xf000) {
			case 0x0000: {
				const type = this.opcode & 0x00ff;

				switch (type) {
					case 0xe0: {
						for (let i = 0; i < this.display.length; i++) {
							this.display[i] = 0;
						}
						break;
					}
					case 0xee: {
						this.sp--;
						this.pc = this.stack[this.sp];
						break;
					}
					default:
						break;
				}
				break;
			}
			// Jump to adress NNN
			case 0x1000: {
				this.pc = this.opcode & 0x0fff;
				break;
			}
			case 0x2000: {
				const address = this.opcode & 0x0fff;
				this.stack[this.sp] = this.pc;
				this.sp++;
				this.pc = address;
				break;
			}
			case 0x3000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const value = this.opcode & 0x0ff;
				if (this.registers[x] === value) {
					this.pc += 2;
				}
				break;
			}
			case 0x4000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const value = this.opcode & 0x0ff;
				if (this.registers[x] !== value) {
					this.pc += 2;
				}
				break;
			}
			case 0x5000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const y = (this.opcode & 0x00f0) >> 4;
				if (this.registers[x] === this.registers[y]) {
					this.pc += 2;
				}
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
			case 0x8000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const y = (this.opcode & 0x00f0) >> 4;
				const type = this.opcode & 0x000f;

				switch (type) {
					case 0x0: {
						this.registers[x] = this.registers[y];
						break;
					}
					case 0x1: {
						this.registers[x] |= this.registers[y];
						break;
					}
					case 0x2: {
						this.registers[x] &= this.registers[y];
						break;
					}
					case 0x3: {
						this.registers[x] ^= this.registers[y];
						break;
					}
					case 0x4: {
						if (
							this.registers[x] + this.registers[y] >
							(1 << 8) - 1
						) {
							this.registers[0xf] = 1;
						} else {
							this.registers[0xf] = 0;
						}
						this.registers[x] += this.registers[y];
						break;
					}
					case 0x5: {
						if (this.registers[x] < this.registers[y]) {
							this.registers[0xf] = 0;
						} else {
							this.registers[0xf] = 1;
						}

						this.registers[x] -= this.registers[y];
						break;
					}
					case 0x6: {
						this.registers[0xf] = this.registers[x] & 0b1;
						this.registers[x] >>= 1;
						break;
					}
					case 0x7: {
						if (this.registers[y] < this.registers[x]) {
							this.registers[0xf] = 0;
						} else {
							this.registers[0xf] = 1;
						}
						this.registers[x] =
							this.registers[y] - this.registers[x];
						break;
					}
					case 0xe: {
						this.registers[0xf] =
							(this.registers[x] & 0b10000000) >> 7;
						this.registers[x] <<= 1;
						break;
					}
					default:
						break;
				}

				break;
			}
			case 0x9000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const y = (this.opcode & 0x00f0) >> 4;
				if (this.registers[x] !== this.registers[y]) {
					this.pc += 2;
				}
				break;
			}
			case 0xa000: {
				this.index = this.opcode & 0x0fff;
				break;
			}
			case 0xb000: {
				const address = this.opcode & 0xfff;
				this.pc = address + this.registers[0];
				break;
			}
			case 0xc000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const value = this.opcode & 0x00ff;
				this.registers[x] = this.random() & value;
				break;
			}
			// Draw
			case 0xd000: {
				const x = this.registers[(this.opcode & 0x0f00) >> 8];
				const y = this.registers[(this.opcode & 0x00f0) >> 4];
				const height = this.opcode & 0x000f;

				this.registers[0xf] = 0;

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
								this.registers[0xf] = 1;
							}
							this.display[dIndex] ^= 1;
						}
					}
				}

				break;
			}
			case 0xe000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const type = this.opcode & 0x00ff;

				switch (type) {
					case 0x9e: {
						if (this.keypad[this.registers[x]] === 1) {
							this.pc += 2;
						}
						break;
					}
					case 0xa1: {
						if (this.keypad[this.registers[x]] === 0) {
							this.pc += 2;
						}
						break;
					}
					default:
						break;
				}

				break;
			}
			case 0xf000: {
				const x = (this.opcode & 0x0f00) >> 8;
				const type = this.opcode & 0x00ff;

				switch (type) {
					case 0x07: {
						this.registers[x] = this.delay;
						break;
					}
					case 0x0a: {
						if (this.keypad[0x0]) {
							this.registers[x] = 0x0;
						} else if (this.keypad[0x1]) {
							this.registers[x] = 0x1;
						} else if (this.keypad[0x2]) {
							this.registers[x] = 0x2;
						} else if (this.keypad[0x3]) {
							this.registers[x] = 0x3;
						} else if (this.keypad[0x4]) {
							this.registers[x] = 0x4;
						} else if (this.keypad[0x5]) {
							this.registers[x] = 0x5;
						} else if (this.keypad[0x6]) {
							this.registers[x] = 0x6;
						} else if (this.keypad[0x7]) {
							this.registers[x] = 0x7;
						} else if (this.keypad[0x8]) {
							this.registers[x] = 0x8;
						} else if (this.keypad[0x9]) {
							this.registers[x] = 0x9;
						} else if (this.keypad[0xa]) {
							this.registers[x] = 0xa;
						} else if (this.keypad[0xb]) {
							this.registers[x] = 0xb;
						} else if (this.keypad[0xc]) {
							this.registers[x] = 0xc;
						} else if (this.keypad[0xd]) {
							this.registers[x] = 0xd;
						} else if (this.keypad[0xe]) {
							this.registers[x] = 0xe;
						} else if (this.keypad[0xf]) {
							this.registers[x] = 0xf;
						} else {
							this.pc -= 2;
						}

						break;
					}
					case 0x15: {
						this.delay = this.registers[x];
						break;
					}
					case 0x18: {
						this.sound = this.registers[x];
						break;
					}
					case 0x1e: {
						this.index += this.registers[x];
						break;
					}
					case 0x29: {
						const address = 0x50 + x * 5;
						this.index = address;
						break;
					}
					case 0x33: {
						let value = this.registers[x];

						let h = 0;
						let t = 0;
						let o = 0;

						while (value - 100 >= 0) {
							value -= 100;
							h++;
						}

						while (value - 10 >= 0) {
							value -= 10;
							t++;
						}

						while (value - 1 >= 0) {
							value -= 1;
							o++;
						}

						this.ram[this.index] = h;
						this.ram[this.index + 1] = t;
						this.ram[this.index + 2] = o;
						break;
					}
					case 0x55: {
						for (let i = 0; i <= x; i++) {
							this.ram[this.index + i] = this.registers[i];
						}
						break;
					}
					case 0x65: {
						for (let i = 0; i <= x; i++) {
							this.registers[i] = this.ram[this.index + i];
						}
						break;
					}
					default:
						break;
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

const renderer = new Renderer(8);
const app = document.getElementById("app") as HTMLElement;
app.appendChild(renderer.canvas);

const delay = 1000 / 700;

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

chip8.load("/breakout.rom", main);
