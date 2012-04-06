// The MIT License (MIT)
// Copyright (c) 2012 Matt Bell
// Modifications Copyright (c) 2012 Chad Etzel

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


var Assembler = 
  (function() {
     var opcodes = {
       'SET': 0x01,
       'ADD': 0x02,
       'SUB': 0x03,
       'MUL': 0x04,
       'DIV': 0x05,
       'MOD': 0x06,
       'SHL': 0x07,
       'SHR': 0x08,
       'AND': 0x09,
       'BOR': 0x0a,
       'XOR': 0x0b,
       'IFE': 0x0c,
       'IFN': 0x0d,
       'IFG': 0x0e,
       'IFB': 0x0f,

       'JSR': 0x10
       //'BRK': 0x20
     };

     var Assembler = function Assembler(cpu) {
       this.cpu = cpu;
     };

     var isWhitespace = function(character) {
       return ['\n', '\r', '\t', ' '].indexOf(character) !== -1;
     };

     var getToken = function(string) {
       return string.split(' ')[0].split('\t')[0];
     };

     Assembler.prototype = {
       clean: function(code) {
	 var subroutines = {},
	 lineNumber = 1,
	 instruction = 0,
	 address = 0,
	 output = '';

	 code += '\n';
	 while(code.length > 0) {
	   var line = code.substr(0, code.indexOf('\n'));
	   if(code.indexOf('\n') === -1) break;
	   else code = code.substr(code.indexOf('\n') + 1);

	   var op = '', a = '', b = '';

	   for(var i = 0; i < line.length; i++) {
	     var c = line.charAt(i);
	     if(!isWhitespace(c)) {
	       if(c === ';') {
		 break;
	       } else if(c === ':') {
		 output += getToken(line.substr(i)) + ' ';
		 i += getToken(line.substr(i)).length;
	       } else {
		 if(!op) {
		   op = getToken(line.substr(i));
		   i += op.length;
		 } else if(!a) {
		   a = getToken(line.substr(i));

		   if(a.charAt(a.length - 1) == ',') {
		     a = a.substr(0, a.length - 1);
		     i++;
		   }

		   i += a.length;
		 } else if(!b) {
		   b = getToken(line.substr(i));
		   i += b.length;
		   break;
		 }
	       }
	     }
	   }

	   if(op) {
	     output += op + ' ' + a + ' ' + b + '\n';
	   }
	 }
	 return output + '\n';
       },

       compile: function(code) {
	 var instruction = 0,
	 address = 0,
	 output = '',
	 subroutineQueue = [],
	 subroutines = {},
	 mem = [];

	 var cpu = this.cpu;

	 while(code.length > 0) {
	   var line = code.substr(0, code.indexOf('\n'));
	   if(code.indexOf('\n') === -1) break;
	   else code = code.substr(code.indexOf('\n') + 1);

	   var op = '', a = '', b = '';

	   for(var i = 0; i < line.length; i++) {
	     var c = line.charAt(i);
	     if(c === ':') {
	       subroutines[getToken(line.substr(i+1))] = address;
	       i += getToken(line.substr(i)).length;
	     } else if(op.length === 0) {
	       op = getToken(line.substr(i));
	       i += op.length;
	     } else if(a.length === 0) {
	       a = getToken(line.substr(i));

	       if(a.charAt(a.length - 1) == ',') {
		 a = a.substr(0, a.length - 1);
		 i++;
	       }

	       i += a.length;
	     } else if(b.length === 0) {
	       b = getToken(line.substr(i));
	       i += b.length;
	       break;
	     } else {
	       throw new Error('Unexpected token (instruction ' + instruction + ')');
	     }
	   }

	   if(op) {
	     op = op.toUpperCase();
	     if(opcodes[op]) {
	       function pack(value) {
		 words[0] += value << (4 + operand * 6);
	       };
	       function parse(arg) {
		 var pointer = false;
		 if(arg.charAt(0) == '[' && arg.charAt(arg.length - 1) == ']') {
		   pointer = true;
		   arg = arg.substring(1, arg.length - 1);
		 }

		 //next word + register
		 if(arg.split('+').length === 2
		    && (parseInt(arg.split('+')[0]) || parseInt(arg.split('+')[0]) === 0)
		    && typeof arg.split('+')[1] === 'string'
		    && typeof mem[arg.split('+')[1].toLowerCase()] === 'number') {

		   var offset = parseInt(arg.split('+')[0]);

		   if(offset < 0 || offset > 0xffff) {
		     throw new Error('Invalid offset [' + arg
				     + '], must be between 0 and 0xffff');
		   }

		   switch(arg.split('+')[1].toLowerCase()) {
		   case 'a': pack(0x10); break;
		   case 'b': pack(0x11); break;
		   case 'c': pack(0x12); break;
		   case 'x': pack(0x13); break;
		   case 'y': pack(0x14); break;
		   case 'z': pack(0x15); break;
		   case 'i': pack(0x16); break;
		   case 'j': pack(0x17); break;
		   }
		   words.push(offset);

		   //literals/pointers, subroutines that are declared already
		 } else if(parseInt(arg) || parseInt(arg) === 0) {
		   var value = parseInt(arg);

		   if(value < 0 || value > 0xffff) {
		     throw new Error('Invalid value 0x' + value.toString(16)
				     + ', must be between 0 and 0xffff');
		   }

		   //0x20-0x3f: literal value 0x00-0x1f (literal)
		   if(value <= 0x1f) {
		     pack(value + 0x20);
		   } else {
		     //0x1e: [next word]
		     if(pointer) pack(0x1e);

		     //0x1f: next word (literal)
		     else pack(0x1f);

		     words.push(value);
		   }

		   //other tokens
		 } else {
		   switch(arg.toLowerCase()) {
		     //0x00-0x07: register (A, B, C, X, Y, Z, I or J, in that order)
		     //0x08-0x0f: [register]
		   case 'a':
		     if(!pointer) pack(0x00);
		     else pack(0x08);
		     break;
		   case 'b':
		     if(!pointer) pack(0x01);
		     else pack(0x09);
		     break;
		   case 'c':
		     if(!pointer) pack(0x02);
		     else pack(0x0a);
		     break;
		   case 'x':
		     if(!pointer) pack(0x03);
		     else pack(0x0b);
		     break;
		   case 'y':
		     if(!pointer) pack(0x04);
		     else pack(0x0c);
		     break;
		   case 'z':
		     if(!pointer) pack(0x05);
		     else pack(0x0d);
		     break;
		   case 'i':
		     if(!pointer) pack(0x06);
		     else pack(0x0e);
		     break;
		   case 'j':
		     if(!pointer) pack(0x07);
		     else pack(0x0f);
		     break;

		     //0x18: POP / [SP++]
		   case 'sp++':
		   case 'pop':
		     pack(0x18);
		     break;

		     //0x19: PEEK / [SP]
		   case 'sp':
		     if(pointer) pack(0x19);
		     else pack(0x1b);
		     break;
		   case 'peek':
		     pack(0x19);
		     break;

		     //0x1a: PUSH / [--SP]
		   case '--sp':
		   case 'push':
		     pack(0x1a);
		     break;

		     //0x1c: PC
		   case 'pc':
		     pack(0x1c);
		     break;

		     //0x1d: O
		   case 'o':
		     pack(0x1d);
		     break;

		   default:
		     if(arg) {
		       pack(0x1f);
		       subroutineQueue.push({
					      id: arg,
					      address: address + words.length
					    });
		       words.push(0x0000);
		     }
		     break;
		   }
		 }

		 operand++;
	       };

	       var words = [opcodes[op]],
	       operand = 0;

	       if(words[0] & 0xf) {
		 parse(a);
		 parse(b);
	       } else {
		 operand++;
		 parse(a);
	       }

	       for(var j in words) mem[address++] = words[j];
	       instruction++;
	       //console.log('Added instruction %d (%s, %s, %s)', instruction, op, a, b);
	       //for(var j in words) console.log(j + ': ' + hex(words[j]));
	     } else {
	       throw new Error('Invalid opcode (' + op + ')');
	     }
	   }
	 }

	 for(var i in subroutineQueue) {
	   var sr = subroutineQueue[i];
	   if(typeof subroutines[sr.id] === 'number') {
	     mem[sr.address] = subroutines[sr.id];
	   } else {
	     throw new Error('Subroutine ' + sr.id + ' was not defined (address ' + sr.address + ')');
	   }
	 }
	 return mem;
       }
     };

     return Assembler;
   })();