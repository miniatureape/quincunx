(function() {

    var TWO_PI = Math.PI * 2;

    var StateMachine = function(state) {
        this.beforeHandlers = {};
        this.whileHandlers = {};
        this.afterHandlers = {};
        this.state = state;
    }

    StateMachine.prototype.setState = function(state) {
        this.doAfter(this.state);
        this.state = state;
        this.doBefore(this.state);
    };

    StateMachine.prototype.doBefore = function(state, fn) {
        this.beforeHandlers[state] = fn;
    };

    StateMachine.prototype.doWhile = function(state, fn) {
        this.whileHandlers[state] = fn;
    };

    StateMachine.prototype.doAfter = function(state, fn) {
        this.afterHandlers[state] = fn;
    };

    StateMachine.prototype.go = function() {
        if (this.whileHandlers.hasOwnProperty(this.state)) {
            this.whileHandlers[this.state].call(this);
        }
    }

    /*
     * Region is a square containing subregions to some depth.
     * A region can contain pegs as contents. 
     *
     * They're used so you don't have to hit test the entire set of pegs.
     */

    var Region = function(pos, dims, depth) {
        this.pos = pos;
        this.dims = dims;
        this.contents = [];
        this.subregions = [];

        if (depth) {
            this.subregions = this.subdivide(this.pos, this.dims, --depth);
        }

    }

    Region.prototype.subdivide = function(pos, dims, depth) {
        var halfx = dims.x / 2;
        var halfy = dims.y / 2;
        return [
            new Region(pos.get(), dims.get().div(2), depth),
            new Region(pos.get().addCoords(halfx, 0), dims.get().div(2), depth),
            new Region(pos.get().addCoords(0, halfy), dims.get().div(2), depth),
            new Region(pos.get().addCoords(halfx, halfy), dims.get().div(2), depth),
        ]
    }

    Region.prototype.debug = function() {
        ctx.strokeRect(this.pos.x, this.pos.y, this.dims.x, this.dims.y);
        this.contents.forEach(function(peg) { 
            peg.debug()
        })
    }

    // Given a position an item, place the item into the contents of the 
    // bottom-most region.
    
    Region.prototype.place = function(pos, item) {
        if (this.hits(pos)) {
            if (this.subregions.length) {
                for (var i = 0; i < this.subregions.length; i++) {
                    this.subregions[i].place(pos, item);
                }
            } else {
                this.contents.push(item);
            }
        }
    }

    // Find the bottom-most subregion given a position 
    
    Region.prototype.find = function(pos) {

        if (!this.hits(pos)) {
            return false;
        }

        if (this.hits(pos) && !this.subregions.length) {
            return this;
        }

        for (var i = 0; i < this.subregions.length; i++) {
            var found = this.subregions[i].find(pos)
            if (found) {
                return found;
            }
        }
    }

    // Does a pos fall within this region?
    
    Region.prototype.hits = function(pos) {
        return (pos.x >= this.pos.x
            && pos.x <= this.pos.x + this.dims.x
            && pos.y >= this.pos.y
            && pos.y <= this.pos.y + this.dims.y);
    }

    // Check a position against the hit function all any region 
    // contents.
    
    Region.prototype.hitsContents = function(ball) {
        var result = null;
        var hit = false;
        for (var i = 0; i < this.contents.length; i++) {
            hit = this.contents[i].hit(ball);
            if (hit) {
                return hit;
            }
        }
    }

    // View methods and state representing an object that grows from
    // a pixel and then begins falling.
    // For simplicity, they force of gravity is contained within.
    
    var Ball = function(pos) {
        this.pos = pos;
        this.size = 1;
        this.targetSize = 10;
        this.fill = '#81A8B8';
        this.growDelta = .7;
        StateMachine.call(this, 'GROW');
        this.initStates();
        this.acc = new Vector2d(0, 0);
        this.vel = new Vector2d(0, 0);
        this.gravity = new Vector2d(0, .9);
    };

    Ball.prototype = new StateMachine;

    Ball.prototype.initStates = function() {
        this.doWhile('GROW', this.grow);
        this.doWhile('FALL', this.fall);
        this.doWhile('DEAD', function() {});
    };

    Ball.prototype.draw = function(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath();
        ctx.scale(this.size, this.size);
        ctx.arc(0,0, 1, 0, TWO_PI);
        ctx.fillStyle = this.fill;
        ctx.fill();
        ctx.restore();
    };

    Ball.prototype.update = function() {
        this.go();
    };

    Ball.prototype.grow = function() {
        if (this.size <= this.targetSize) {
            this.size += this.growDelta * (this.size / 2);
        } else {
            this.setState('FALL');
        }
    };

    Ball.prototype.fall = function() {
        this.vel.add(this.gravity.get());
        this.vel.add(this.acc.get());
        this.pos.add(this.vel.get());
        this.acc.mult(0);
        if (this.pos.y > (500 + this.size / 2)) {
            this.setState('DEAD');
        }
    };

    // Model and view functions for an obstacle the ball may meet and 
    // bounce off of.

    var Peg = function(pos) {
        this.pos = pos;
        this.size = 5;
        this.fill = '#A4BCC2';
        this.numHits = 0;
    }

    Peg.prototype.debug = function(pos, alpha) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath();
        ctx.scale(this.size, this.size);
        ctx.arc(0,0, 1, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
    }

    Peg.prototype.hit = function(ball) {
        var ballpos = ball.pos.get();
        var pegpos = this.pos.get();

        var dist = Vector2d.dist(ballpos, pegpos);
        if (dist <= (this.size + ball.size)) {
            return this;
        }

        return false;
    };

    Peg.prototype.draw = function(ctx, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath();
        ctx.scale(this.size, this.size);
        ctx.arc(0,0, 1, 0, TWO_PI);
        ctx.fillStyle = this.fill;
        ctx.fill();
        ctx.restore();
    };

    var Board = function(dims, spacing) {
        this.region = new Region(new Vector2d(), dims, 3);
        this.pegs = this.layoutPegs(dims, spacing);
    }

    Board.prototype.layoutPegs = function(dims, spacing) {

        var pegs = [];

        for (var x = spacing ; x < dims.x; x += spacing) {
            for (var y = spacing * 3; y < dims.y; y += spacing) {
                peg = new Peg(new Vector2d(x, y))
                peg.draw(ctx);
                this.region.place(peg.pos, peg);
                pegs.push(peg);
            }
        }

        return pegs;
    }

    Board.prototype.reckon = function(ball) {

        // Find the region for the current posion
        var region = this.region.find(ball.pos);

        // If there is no region, or it doesn't have pegs
        // bail out.
        if (!region || !region.contents.length) {
            return false;
        }

        // If it does, check to see if any of those pegs
        // actually hit the ball.
        var peg = region.hitsContents(ball);
        if (peg) {
            ball.pos.add(Vector2d.sub(ball.pos, peg.pos));
            var vel = ball.vel.get();
            ball.vel.zero();
            ball.acc.zero();
            ball.vel.set(Vector2d.sub(ball.pos, peg.pos).get().normalize().scale(vel.mag() / 1.2));
            peg.numHits++;
        }

        return peg;
    }

    Board.prototype.range = function(val, min, max) {
        if (max === min) return 0;
        return (val / (max - min));
    }

    Board.prototype.draw = function(ctx) {
        var min = 100000;
        var max = 0;
        for (var i = 0; i < this.pegs.length; i++) {
            if (this.pegs[i].numHits > max)  {
                max = this.pegs[i].numHits;
            }
            if (this.pegs[i].numHits < min) {
                min = this.pegs[i].numHits;
            }
        }

        for (var i = 0; i < this.pegs.length; i++) {
            this.pegs[i].draw(ctx, this.range(this.pegs[i].numHits, min, max));
        }

    }

    var ctx = canvas.getContext('2d');
    var playBtn = document.querySelector('.poster');
    var ball, board;

    var newBall = function() {
        var pos = new Vector2d(250 + ((Math.random() * 4) - 2), 50);
        ball = new Ball(pos);
    }

    var run = function() {

        requestAnimationFrame(run);

        if (ball.state === 'DEAD') {
            newBall();
        } else if (ball.state !== 'PAUSE') {
            ctx.clearRect(0, 0, 500, 500);
            ball.update();
            ball.draw(ctx);
            board.reckon(ball);
            board.draw(ctx);
        }
    }

    var hidePoster = function() {
        playBtn.innerHTML = '';
        playBtn.classList.add('disolve');
        playBtn.removeEventListener('click', start);
    }

    var start = function() {
        hidePoster();
        newBall();
        run();
    }

    board = new Board(new Vector2d(500, 500), 50);

    playBtn.addEventListener('click', start);

})()
