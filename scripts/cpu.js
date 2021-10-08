class CPU {
  constructor(renderer, keyboard, speaker) {
    this.renderer = renderer;
    this.keyboard = keyboard;
    this.speaker = speaker;

    // 内存 4k
    this.memory = new Uint8Array(4096);

    // 16 个 8 位寄存器
    this.v = new Uint8Array(16)

    // 当前内存地址
    this.i = 0;

    // 定时器
    this.delayTimer = 0;
    this.soundTimer = 0;

    // 程序计数器。表示当前程序执行的地址。
    this.pc = 0x200;

    this.stack = new Array();

    // 模拟器是否暂停
    this.pause = false;

    // 模拟器执行的速度
    this.speed = 10;
  }

  // 精灵存储在内存中
  loadSpritesIntoMemory() {
    // Array of hex values for each sprite. Each sprite is 5 bytes.
    // The technical reference provides us with each one of these values.
    const sprites = [
      0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
      0x20, 0x60, 0x20, 0x20, 0x70, // 1
      0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
      0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
      0x90, 0x90, 0xF0, 0x10, 0x10, // 4
      0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
      0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
      0xF0, 0x10, 0x20, 0x40, 0x40, // 7
      0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
      0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
      0xF0, 0x90, 0xF0, 0x90, 0x90, // A
      0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
      0xF0, 0x80, 0x80, 0x80, 0xF0, // C
      0xE0, 0x90, 0x90, 0x90, 0xE0, // D
      0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
      0xF0, 0x80, 0xF0, 0x80, 0x80  // F
    ];

    // According to the technical reference, sprites are stored in the interpreter section of memory starting at hex 0x000
    for (let i = 0; i < sprites.length; i++) {
      this.memory[i] = sprites[i];
    }
  }

  loadProgramIntoMemory(program) {
    for (let loc = 0; loc < program.length; loc++) {
      this.memory[0x200 + loc] = program[loc];
    }
  }

  // 将游戏 rom 加载到内存中
  loadRom(romName) {
    var request = new XMLHttpRequest;
    var self = this;

    request.onload = function () {
      // If the request response has content
      if (request.response) {
        // Store the contents of the response in an 8-bit array
        let program = new Uint8Array(request.response);

        // Load the ROM/program into memory
        self.loadProgramIntoMemory(program);

        console.log('load rom ok...')
      }
    }

    request.open('GET', 'roms/' + romName);
    request.responseType = 'arraybuffer';

    request.send();
  }

  cycle() {
    for (let i = 0; i < this.speed; i++) {
      if (!this.paused) {
        let opcode = (this.memory[this.pc] << 8 | this.memory[this.pc + 1]);
        this.executeInstruction(opcode);
      }
    }

    if (!this.pause) {
      this.updateTimers();
    }

    this.playSound();
    this.renderer.render();
  }

  updateTimers() {
    if (this.deplayTimer > 0) {
      this.delayTimer -= 1;
    }

    if (this.soundTimer > 0) {
      this.soundTimer -= 1;
    }
  }

  playSound() {
    if (this.soundTimer > 0) {
      this.speaker.play(440);
    } else {
      this.speaker.stop();
    }
  }

  executeInstruction(opcode) {
    // 每个指令是 2 字节大小
    this.pc += 2;

    let x = (opcode & 0x0F00) >> 8;

    let y = (opcode & 0x00F0) >> 4;

    switch (opcode & 0xF000) {
      case 0x0000:
        switch (opcode) {
          case 0x00E0:
            this.renderer.clear();
            break;
          case 0x00EE:
            this.pc = this.stack.pop();
            break;
        }

        break;
      case 0x1000:
        this.pc = (opcode & 0xFFF);
        break;
      case 0x2000:
        this.stack.push(this.pc);
        this.pc = (opcode & 0xFFF);
        break;
      case 0x3000:
        if (this.v[x] === (opcode & 0xFF)) {
          this.pc += 2;
        }
        break;
      case 0x4000:
        if (this.v[x] !== (opcode & 0xFF)) {
          this.pc += 2;
        }
        break;
      case 0x5000:
        if (this.v[x] === this.v[y]) {
          this.pc += 2;
        }
        break;
      case 0x6000:
        this.v[x] = (opcode & 0xFF);
        break;
      case 0x7000:
        this.v[x] += (opcode & 0xFF);
        break;
      case 0x8000:
        switch (opcode & 0xF) {
          case 0x0:
            this.v[x] = this.v[y];
            break;
          case 0x1:
            this.v[x] |= this.v[y];
            break;
          case 0x2:
            this.v[x] &= this.v[y];
            break;
          case 0x3:
            this.v[x] ^= this.v[y];
            break;
          case 0x4:
            let sum = (this.v[x] += this.v[y]);

            this.v[0xF] = 0;

            if (sum > 0xFF) {
              this.v[0xF] = 1;
            }

            this.v[x] = sum;
            break;
          case 0x5:
            this.v[0xF] = 0;

            if (this.v[x] > this.v[y]) {
              this.v[0xF] = 1;
            }

            this.v[x] -= this.v[y];
            break;
          case 0x6:
            this.v[0xF] = (this.v[x] & 0x1);

            this.v[x] >>= 1;
            break;
          case 0x7:
            this.v[0xF] = 0;

            if (this.v[y] > this.v[x]) {
              this.v[0xF] = 1;
            }

            this.v[x] = this.v[y] - this.v[x];
            break;
          case 0xE:
            this.v[0xF] = (this.v[x] & 0x80);
            this.v[x] <<= 1;
            break;
        }

        break;
      case 0x9000:
        if (this.v[x] !== this.v[y]) {
          this.pc += 2;
        }
        break;
      case 0xA000:
        this.i = (opcode & 0xFFF);
        break;
      case 0xB000:
        this.pc = (opcode & 0xFFF) + this.v[0];
        break;
      case 0xC000:
        let rand = Math.floor(Math.random() * 0xFF);

        this.v[x] = rand & (opcode & 0xFF);
        break;
      case 0xD000:
        let width = 8;
        let height = (opcode & 0xF);

        this.v[0xF] = 0;

        for (let row = 0; row < height; row++) {
          let sprite = this.memory[this.i + row];

          for (let col = 0; col < width; col++) {
            // If the bit (sprite) is not 0, render/erase the pixel
            if ((sprite & 0x80) > 0) {
              // If setPixel returns 1, which means a pixel was erased, set VF to 1
              if (this.renderer.setPixel(this.v[x] + col, this.v[y] + row)) {
                this.v[0xF] = 1;
              }
            }

            // Shift the sprite left 1. This will move the next next col/bit of the sprite into the first position.
            // Ex. 10010000 << 1 will become 0010000
            sprite <<= 1;
          }
        }

        break;
      case 0xE000:
        switch (opcode & 0xFF) {
          case 0x9E:
            if (this.keyboard.isKeyPressed(this.v[x])) {
              this.pc += 2;
            }
            break;
          case 0xA1:
            if (!this.keyboard.isKeyPressed(this.v[x])) {
              this.pc += 2;
            }
            break;
        }

        break;
      case 0xF000:
        switch (opcode & 0xFF) {
          case 0x07:
            this.v[x] = this.delayTimer;
            break;
          case 0x0A:
            this.paused = true;

            this.keyboard.onNextKeyPress = function (key) {
              this.v[x] = key;
              this.paused = false;
            }.bind(this);
            break;
          case 0x15:
            this.delayTimer = this.v[x];
            break;
          case 0x18:
            this.soundTimer = this.v[x];
            break;
          case 0x1E:
            this.i += this.v[x];
            break;
          case 0x29:
            this.i = this.v[x] * 5;
            break;
          case 0x33:
            // Get the hundreds digit and place it in I.
            this.memory[this.i] = parseInt(this.v[x] / 100);

            // Get tens digit and place it in I+1. Gets a value between 0 and 99,
            // then divides by 10 to give us a value between 0 and 9.
            this.memory[this.i + 1] = parseInt((this.v[x] % 100) / 10);

            // Get the value of the ones (last) digit and place it in I+2.
            this.memory[this.i + 2] = parseInt(this.v[x] % 10);
            break;
          case 0x55:
            for (let registerIndex = 0; registerIndex <= x; registerIndex++) {
              this.memory[this.i + registerIndex] = this.v[registerIndex];
            }
            break;
          case 0x65:
            for (let registerIndex = 0; registerIndex <= x; registerIndex++) {
              this.v[registerIndex] = this.memory[this.i + registerIndex];
            }
            break;
        }

        break;

      default:
        throw new Error('Unknown opcode ' + opcode);
    }
  }
}

export default CPU;