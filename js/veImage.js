;(function (factory) {
    /* CommonJS module. */
    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = factory(window);
        /* AMD module. */
    } else if (typeof define === "function" && define.amd) {
        define(factory(window));
        /* Browser globals. */
    } else {
        factory(window);
    }
}(function(global, undefined) {
    "use strict";

    var veImagePrototype = veImage.prototype;
    //默认参数
    var defaults = {
        canvas: null,//画布
        image: null,//图片
        relativeWidth: 750 //相对宽度，裁剪的时候可计算比率
    };

    //绑定的事件 目前只适用于webkit内核浏览器
    var events = {start:'touchstart', move:'touchmove', end:'touchend'};

    /**
     * 简单的数组合并
     */
    function extend(source, target) {
        for(var key in source) {
            if(source.hasOwnProperty(key))
                target[key] = source[key];
        }
        return target;
    }

    function veImage(opts) {
        if(!opts.canvas || !opts.image) {
            throw new Error('请传入正确的画布或图片');
        }

        this.opts = extend(opts, defaults); //默认参数与传入参数合并
        this.canvas = this.opts.canvas;//画布
        this.size = this.canvas.getBoundingClientRect();//画布的尺寸参数
        this.context = this.canvas.getContext('2d');//画布上下文
        this.image = opts.image;//图片

        //设置画布的宽高
        this.canvas.width = this.size.width;
        this.canvas.height = this.size.height;

        //将图片用合适的尺寸放入到画布中
        var rateWidth = this.canvas.width / this.image.width,//画布与图片的宽比
            rateHeight = this.canvas.height / this.image.height,//画布与图片的高比
            rate = rateWidth > rateHeight ? rateHeight : rateWidth;//取小的比率

        //设置目标宽高 也就是缩放后的宽高
        this.dWidth = this.image.width * rate;
        this.dHeight = this.image.height * rate;

        //将画布的中心点 作为起始坐标 缩放的时候会从中间开始放大，效果更佳，图片也能画在正中间
        this.origin = {
            x: Math.floor(this.canvas.width / 2),
            y: Math.floor(this.canvas.height / 2)
        };

        this._draw();//画图
        this._bind(); //绑定手指事件
    }

    /**
     * 记录手指的坐标
     * @param touches
     * @private
     */
    function _finger(touches) {
        var coordinate = [],
            len = touches.length;
        for(var i=0; i<len; i++) {//TouchList类型 不能用forEach
            coordinate.push({x:touches[i].clientX, y:touches[i].clientY})
        }
        return coordinate;
    }

    /**
     * 绑定开始事件
     */
    veImagePrototype.startEvt = function(e) {
        this.start = _finger(e.touches);//记录开始的坐标
        this._mode(e.touches);//模式初始化
    };

    /**
     * 绑定手指移动事件
     */
    veImagePrototype.moveEvt = function(e) {
        e.preventDefault();//禁止滚动

        var fingers = _finger(e.touches);//记录移动中的坐标
        //不能仅仅通过手指数量来判断 因为当缩放后，移除手指的时候，会出现一个手指还停留在页面上，导致位移
        if(this.mode == 1) {//位移
            this._translate(fingers);
        }else if(this.mode == 2) {//缩放
            this._zoom(fingers);
        }
        //将start的坐标复为移动中的坐标 时时计算偏移值，不然会变得非常大，图片在移动中会飞出画面
        this.start = fingers;
    };

    /**
     * 模式判断
     */
    veImagePrototype._mode = function(fingers) {
        if(fingers.length == 1) {
            this.mode = 1;//位移模式
        }else if(fingers.length > 1) {
            this.mode = 2;//缩放模式
        }
    };

    /**
     * 位移
     */
    veImagePrototype._translate = function(fingers) {
        //计算手指的位移
        this._draw(
            fingers[0].x - this.start[0].x,
            fingers[0].y - this.start[0].y
        );
    };

    /**
     * 缩放
     */
    veImagePrototype._zoom = function(fingers) {
        //上一次手指两个X轴和Y轴之间的距离
        var lastOffset = {
            x : Math.abs(this.start[0].x - this.start[1].x),
            y : Math.abs(this.start[0].y - this.start[1].y)
        };
        if(lastOffset.x == 0 || lastOffset.y == 0) {//防止分母是0
            return;
        }
        //缩放不需要坐标轴偏移 但计算缩放值 需要偏移值
        //缩放率分母是上一次手指，分子是当前手指两个X轴和Y轴之间的距离
        this._draw(
            0, 0,
            Math.abs(fingers[0].x - fingers[1].x) / lastOffset.x,
            Math.abs(fingers[0].y - fingers[1].y) / lastOffset.y
        );
    };

    /**
     * 绑定结束事件
     */
    veImagePrototype.endEvt = function(e) {

    };

    /**
     * 裁剪
     * @param w 裁剪的宽度
     * @param h 裁剪的高度
     * @param x 开始裁剪的X轴坐标
     * @param y 开始裁剪的Y轴坐标
     * @returns {string}
     */
    veImagePrototype.crop = function(w, h, x, y) {
        var canvas = document.createElement('canvas'),
            context = canvas.getContext('2d'),
            rate = this.canvas.width / this.opts.relativeWidth;//当前画布的宽度与设置的相对宽度 计算比率
        x *= rate;
        y *= rate;
        canvas.width = w*rate;
        canvas.height = h*rate;
        context.drawImage(
            this.canvas,
            x, y, canvas.width, canvas.height,
            0, 0, canvas.width, canvas.height
        );
        return canvas.toDataURL();
    };

    /**
     * 画图
     * @param dx X轴偏移量
     * @param dy Y轴偏移量
     * @param zoomWidth 宽度缩放比
     * @param zoomHeight 高度缩放比
     * @private
     */
    veImagePrototype._draw = function(dx, dy, zoomWidth, zoomHeight) {
        //清空画布 擦除之前绘制的所有内容 不清空的话会显示各个步骤的画布
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.save();//保存状态

        //防止缩放到0值，导致图片消失
        if(zoomHeight == 0 || zoomWidth == 0){
            return ;
        }

        //计算偏移
        this.origin.x += dx || 0;//计算X轴坐标
        this.origin.y += dy || 0;//计算Y轴坐标
        this.context.translate(this.origin.x, this.origin.y);//位移

        //计算缩放
        zoomWidth = zoomWidth || 1;
        zoomHeight = zoomHeight || 1;
        var zoom = zoomWidth > zoomHeight ? zoomWidth : zoomHeight;//统一按一个比例做缩放
        this.dWidth *= zoom;//宽度缩放
        this.dHeight *= zoom;//高度缩放

        //画图
        this.context.drawImage(
            this.image,
            0, 0, this.image.width, this.image.height,
            -this.dWidth / 2, -this.dHeight / 2, this.dWidth, this.dHeight);//目标画布的中心点

        //还原到上一个状态 也就是空画布的时候
        this.context.restore();
    };

    /**
     * 绑定事件
     */
    veImagePrototype._bind = function() {
        this.canvas.addEventListener(events.start, this);
        this.canvas.addEventListener(events.move, this);
        this.canvas.addEventListener(events.end, this);
    };

    /**
     * 高级的绑定方法
     */
    veImagePrototype.handleEvent = function(e) {
        switch (e.type) {
            case events.start:
                this.startEvt(e);
                break;
            case events.move:
                this.moveEvt(e);
                break;
            case events.end:
                this.endEvt(e);
                break;
        }
    };

    global.veImage = veImage;
    return veImage;
}));