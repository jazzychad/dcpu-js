// The MIT License (MIT)
// Copyright (c) 2012 Chad Etzel

// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


var _trace = function(msg) {
  //if (window.console && window.console.log) {
  //  console.log(msg);
  //}
  var c = document.getElementById("trace");
  if (c) {
    var s = c.innerText;
    s = s + msg + "\n";
    c.innerText = s;
    c.scrollTop = c.scrollHeight;
  }
};
var _ramlog = function(msg) {
  var c = document.getElementById("ramconsole");
  if (c) {
    c.innerHTML = msg;
  }
};
var _console = function(msg) {
  var c = document.getElementById("console");
  if (c) {
    c.innerHTML = msg;
  }
};

var skiptable = [
0, //0x00
0, //0x01
0, //0x02
0, //0x03
0, //0x04
0, //0x05
0, //0x06
0, //0x07
0, //0x08
0, //0x09
0, //0x0a
0, //0x0b
0, //0x0c
0, //0x0d
0, //0x0e
0, //0x0f
1, //0x10
1, //0x11
1, //0x12
1, //0x13
1, //0x14
1, //0x15
1, //0x16
1, //0x17
0, //0x18
0, //0x19
0, //0x1a
0, //0x1b
0, //0x1c
0, //0x1d
1, //0x1e
1  //0x1f
];

var dcpu = function() {
  this.ramsize = 0x10000;
  var size = this.ramsize + 8 + 1 + 1 + 1 + 1 + 32;
  var litarr = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
		0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
		0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
		0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f];

  this.data = new Array(size);

  this.r = 0;
  this.pc = this.r + 8;
  this.sp = this.pc + 1;
  this.ov = this.sp + 1;
  this.unused = this.ov + 1;
  this.lit = this.unused + 1;
  this.m = this.lit + litarr.length;

  this.video_start = this.m + 0x8000;
  this.video_size = 0x400; // 32x32 = 1024

  this.reset = function() {
    for (var i = 0; i < size; i++) {
      this.data[i] = 0;
    }
    for (i = 0; i < litarr.length; i++) {
      this.data[this.lit + i] = litarr[i];
    }
    return true;
  };

  for (var i = 0; i < litarr.length; i++) {
    this.data[this.lit + i] = litarr[i];
  }

};

var dcpu_skip = function(d) {
  var op = d.data[d.m + d.data[d.pc]++];
  d.data[d.pc] += skiptable[(op >> 10) & 0xffff];
  if ((op & 15) == 0) {
    d.data[d.pc] += skiptable[(op >> 4) & 31];
  }
};

var dcpu_opr = function(d, code) {
  switch(code) {

  case 0x00: case 0x01: case 0x02: case 0x03:
  case 0x04: case 0x05: case 0x06: case 0x07: // register
    return d.r + (code & 7);

  case 0x08: case 0x09: case 0x0a: case 0x0b:
  case 0x0c: case 0x0d: case 0x0e: case 0x0f: // [register]
    return d.m + d.data[d.r + (code & 7)];

  case 0x10: case 0x11: case 0x12: case 0x13:
  case 0x14: case 0x15: case 0x16: case 0x17: // [next word + register]
    return d.m + ((d.data[d.r + (code & 7)] + d.data[d.m + d.data[d.pc]++]) & 0xffff);

  case 0x18: // pop
    return d.m + d.data[d.sp]++;

  case 0x19: // peek
    return d.m + d.data[d.sp];

  case 0x1a: // push
    d.data[d.sp]--;
    return d.m + d.data[d.sp];

  case 0x1b: // sp
    return d.sp;

  case 0x1c: // pc
    return d.pc;

  case 0x1d: // ov
    return d.ov;

  case 0x1e: // [next word]
    return d.m + d.data[d.m + d.data[d.pc]++];

  case 0x1f: // next word (literal)
    return d.m + d.data[d.pc]++;

  default: // literal 0x00-0x1f
    return d.lit + (code & 0x1f);
  }
};

var dcpu_step = function(d) {

  var op;
  var dst;
  var res;
  var a, b, pa, pb;
  var cond = false;

  //d.data[d.pc]++;
  op = d.data[d.m + d.data[d.pc]++];

  if ((op & 0xf) == 0) { // non-basic instr
    pa = dcpu_opr(d, op >> 10);
    a = d.data[pa];
    switch ((op >> 4) & 0x3f) {
    case 0x01:
      d.data[d.sp]--;
      d.data[d.m + d.data[d.sp]] = d.data[d.pc];
      d.data[d.pc] = a;
      return;
    default:
      _trace("< ILLEGAL OPCODE > ");
      throw "ILLEGAL OPCODE 0x" + op.toString(16);
    }
  }

  dst = (op >> 4) & 0x3f;
  pa = dcpu_opr(d, dst);
  a = d.data[pa];
  pb = dcpu_opr(d, (op >> 10) & 0x3f);
  b = d.data[pb];

  switch (op & 0xf) {
  case 0x1: // SET a, b
    res = b;
    break;

  case 0x2: // ADD a, b
    res = a + b;
    d.data[d.ov] = (res >> 16) & 0xffff;
    break;

  case 0x3: // SUB a, b
    res = a - b;
    d.data[d.ov] = (res >> 16) & 0xffff;
    break;

  case 0x4: // MUL a, b
    res = a * b;
    d.data[d.ov] = (res >> 16) & 0xffff;
    break;

  case 0x5: // DIV a, b
    if (b) {
      res = Math.floor(a / b);
    } else {
      res = 0;
    }
    d.data[d.ov] = (res >> 16) & 0xffff;
    break;

  case 0x6: // MOD a, b
    if (b) {
      res = a % b;
    } else {
      res = 0;
    }
    break;

  case 0x7: // SHL a, b
    res = (a << b) & 0xffffffff;
    d.data[d.ov] = (res >> 16) & 0xffff;
    break;

  case 0x8: // SHR a, b
    res = (a >> b) & 0xffffffff;
    d.data[d.ov] = (res >> 16) & 0xffff;
    break;

  case 0x9: // AND
    res = a & b;
    break;

  case 0xa: // BOR
    res = a | b;
    break;

  case 0xb: // XOR
    res = a ^ b;
    break;

  case 0xc: // IFE
    if (a != b) dcpu_skip(d);
    return;

  case 0xd: // IFN
    if (a == b) dcpu_skip(d);
    return;

  case 0xe: // IFG
    if (a <= b) dcpu_skip(d);
    return;

  case 0xf: // IFB
    if ((a & b) == 0) dcpu_skip(d);
    return;
  }

  if (dst < 0x1f) {
    d.data[pa] = res & 0xffff;
    if (pa >= d.video_start && pa <= d.video_start + d.video_size) {
      dcpu_print(d);
    }
  }
};

var dcpu_print = function(d) {
  var s = "";
  var i, _end, word;
  var j = 0;
  for (i = d.video_start, _end = d.video_start + d.video_size; i < _end; i++) {
    word = d.data[i];
    s += (word && 0xff) ? String.fromCharCode(word & 0xff) : ".";
    j++;
    if (!(j % 32)) {
      s += "\n";
    }
  }
  _console(s);
};

var dumpram = function(d) {
  var out = "";
  out += "= REGISTERS: =\n" +
    "A:  " + hex(d.data[d.r + 0]) + "\n" +
    "B:  " + hex(d.data[d.r + 1]) + "\n" +
    "C:  " + hex(d.data[d.r + 2]) + "\n" +
    "X:  " + hex(d.data[d.r + 3]) + "\n" +
    "Y:  " + hex(d.data[d.r + 4]) + "\n" +
    "Z:  " + hex(d.data[d.r + 5]) + "\n" +
    "I:  " + hex(d.data[d.r + 6]) + "\n" +
    "J:  " + hex(d.data[d.r + 7]) + "\n" +
    "\n" +
    "PC: [" + hex(d.data[d.pc]) + "]\n" +
    "SP: *" + hex(d.data[d.sp]) + "*\n" +
    "OV:  " + hex(d.data[d.ov]) + "\n\n";

  out += "STEP: " + stepnum + "\n\n";

  out += "= RAM: =\n";

  var pop = false;
  var i, j, c, e;
  for (i = 0; i < d.ramsize; i += 8) {
    pop = false;
    for (j = 0; j < 8; j++) {
      if (d.data[d.m + i + j] || d.data[d.pc] == i + j || d.data[d.sp] == i + j) {
	pop = true;
	break;
      }
    }

    if (pop) {
      out += "\n" + hex(i) + ": ";
      c = "";
      e = "";

      for (j = 0; j < 8; j++) {
	if (d.data[d.pc] === i + j) {c = "["; e = "]";}
	//else if (d.data[d.pc] === i + j - 1) out += "]";
	else if (d.data[d.sp] === i + j) {c = "*"; e = "*";}
	//else if (d.data[d.sp] === i + j - 1) out += "*";
	else {c = " "; e = " ";}

	out += c;
	out += hex(d.data[d.m + i + j]);
	out += e + " ";
      }
    }
  }
  return out;
};

var dumpheader = function() {
  return "PC   SP   OV   A    B    C    X    Y    Z    I    J\n" +
    "---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----";
};

var hex = function(num, len) {
  if (len == undefined) len = 4;
  var s = num.toString(16);
  while (s.length < len) {
    s = "0" + s;
  }
  return s;
};

var dumpstate = function() {
  var i = 0;
  return function(d) {
    ++i;
    if (!(i % 20)) {
      _trace(dumpheader());
    }
    return hex(d.data[d.pc], 4) +
      " " +
      hex(d.data[d.sp], 4) +
      " " +
      hex(d.data[d.ov], 4) +
      " " +
      hex(d.data[d.r + 0], 4) +
      " " +
      hex(d.data[d.r + 1], 4) +
      " " +
      hex(d.data[d.r + 2], 4) +
      " " +
      hex(d.data[d.r + 3], 4) +
      " " +
      hex(d.data[d.r + 4], 4) +
      " " +
      hex(d.data[d.r + 5], 4) +
      " " +
      hex(d.data[d.r + 6], 4) +
      " " +
      hex(d.data[d.r + 7], 4);
  };
}();

var load = function(d, data) {
  var lines = data.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var chunks = lines[i].split(" ");
    d.data[d.m + i] = parseInt(chunks[0], 16);
    if (isNaN(d.data[d.m + i])) {
      d.data[d.m + i] = 0;
    }
  }
  _trace("< LOADED " + i + " WORDS >");
  _ramlog(dumpram(d));
};

var main = function() {
  running = true;
  steploop(d);

};

var steploop = function(d) {
  if (running) {
    _trace(dumpstate(d));
    _ramlog(dumpram(d));
    dcpu_step(d);
    stepnum++;
    setTimeout(function() {steploop(d);}, 10);
  }
};


function reset_cpu() {
  stepnum = 0;
  d.reset();
  d.data[d.sp] = 0xffff;
  var c = document.getElementById("console");
  if (c) {
    c.innerText = "";
  }
  _trace(dumpheader());
  _trace(dumpstate(d));
  _ramlog(dumpram(d));
  dcpu_print(d);
}

function hexload() {
  var hexbin = document.getElementById("hexbin");
  load(d, hexbin.value);
};

function step() {
  dcpu_step(d);
  _trace(dumpstate(d));
  _ramlog(dumpram(d));
  stepnum++;

}

function assemble() {
  var asm = document.getElementById("assembly").value;
  var a = new Assembler(null);
  var mem = a.compile(a.clean(asm));
  var s = "";
  for (var i = 0; i < mem.length; i++) {
    s += hex(mem[i]) + "\n";
  }
  document.getElementById("hexbin").value = s;
}

var d = new dcpu();
var running = false;
var stepnum = 0;

reset_cpu();
hexload();