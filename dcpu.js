var _log = function(msg) {
  if (window.console && window.console.log) {
    console.log(msg);
  }
  var c = document.getElementById("console");
  if (c) {
    var s = c.innerText;
    s = s + msg + "\n";
    c.innerText = s;
  }
};

var dcpu = function() {
  var size = 0x10000 + 8 + 1 + 1 + 1 + 1 + 32;
  var litarr = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
		0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
		0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
		0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f];

  this.data = new Array(size);

  this.r = 0;
  this.pc = this.r + 8;
  this.sp = this.pc + 1;
  this.ov = this.sp + 1;
  this.skip = this.ov + 1;
  this.lit = this.skip + 1;
  this.m = this.lit + litarr.length;

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
    switch ((op >> 4) & 0x3f) {
    case 0x01:
      pa = dcpu_opr(d, op >> 10);
      a = d.data[pa];
      if (d.data[d.skip]) {
	d.data[d.skip] = 0;
      } else {
	d.data[d.sp]--;
	d.data[d.m + d.data[d.sp]] = d.data[d.pc];
	d.data[d.pc] = a;
      }
      return;
    default:
      _log("< ILLEGAL OPCODE > ");
      throw "ILLEGAL OPCODE " + op.toString(16);
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
    break;

  case 0x3: // SUB a, b
    res = a - b;
    break;

  case 0x4: // MUL a, b
    res = a * b;
    break;

  case 0x5: // DIV a, b
    if (b) {
      res = Math.floor(a / b);
    } else {
      res = 0;
    }
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
    break;

  case 0x8: // SHR a, b
    res = (a >> b) & 0xffffffff;
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
    res = (a == b) ? 1 : 0;
    cond = true;
    break;

  case 0xd: // IFN
    res = (a != b) ? 1 : 0;
    cond = true;
    break;

  case 0xe: // IFG
    res = (a > b) ? 1 : 0;
    cond = true;
    break;

  case 0xf: // IFB
    res = ((a & b) != 0) ? 1 : 0;
    cond = true;
    break;
  }

  if (cond) {
    if (d.data[d.skip]) {
      d.data[d.skip] = 0;
      return;
    }
    d.data[d.skip] = res == 0 ? 1 : 0;
    return;
  }

  if (d.data[d.skip]) {
    d.data[d.skip] = 0;
    return;
  }

  if (dst < 0x1f) {
    d.data[pa] = res & 0xffff;
    d.data[d.ov] = (res >> 16) & 0xffff;
  }
};

var dumpheader = function() {
  return "PC   SP   OV   SKIP A    B    C    X    Y    Z    I    J\n" +
    "---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----";
};

var hex = function(num, len) {
  var s = num.toString(16);
  while (s.length < len) {
    s = "0" + s;
  }
  return s;
};

var dumpstate = function(d) {
  return hex(d.data[d.pc], 4) +
    " " +
    hex(d.data[d.sp], 4) +
    " " +
    hex(d.data[d.ov], 4) +
    " " +
    hex(d.data[d.skip], 4) +
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

var load = function(d, data) {
  var lines = data.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var chunks = lines[i].split(" ");
    d.data[d.m + i] = parseInt(chunks[0], 16);
  }
  _log("< LOADED " + i + " WORDS >");
};

var main = function() {
  var hexbin = document.getElementById("hexbin");

  var c = document.getElementById("console");
  if (c) {
    c.innerText = "";
  }

  var d = new dcpu();

  d.reset();
  d.data[d.sp] = 0xffff;

  load(d, hexbin.value);

  _log(dumpheader());
  while (true) {
    _log(dumpstate(d));
    dcpu_step(d);
  }

};


var dd = new dcpu();

function reset() {
  dd.reset();
  dd.data[dd.sp] = 0xffff;
  var hexbin = document.getElementById("hexbin");
  var c = document.getElementById("console");
  if (c) {
    c.innerText = "";
  }
  load(dd, hexbin.value);
  _log(dumpheader());
  _log(dumpstate(dd));

}

function step() {
  dcpu_step(dd);
  _log(dumpstate(dd));

}
