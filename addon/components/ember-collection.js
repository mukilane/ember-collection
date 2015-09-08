import Ember from 'ember';
import layout from './ember-collection/template';
import { translateCSS } from '../utils/translate';
import needsRevalidate from '../utils/needs-revalidate';
var decodeEachKey = Ember.__loader.require('ember-htmlbars/utils/decode-each-key')['default'];
const { get, set } = Ember;

class Cell {
  constructor(key, item, index, style) {
    this.key = key;
    this.hidden = false;
    this.item = item;
    this.index = index;
    this.style = style;
  }
}

function formatStyle(pos, width, height) {
  let css = 'position:absolute;top:0;left:0;';
  css += translateCSS(pos.x, pos.y);
  css += 'width:' + width + 'px;height:' + height + 'px;';
  return css;
}

export default Ember.Component.extend({
  layout: layout,

  init() {
    // State pulled from attrs is prefixed with an underscore
    // so that there's no chance of shadowing the attrs proxy.
    this._buffer = undefined;
    this._cellLayout = undefined;
    this._items = undefined;
    this._scrollLeft = undefined;
    this._scrollTop = undefined;
    this._clientSize = undefined;
    this._contentSize = undefined;

    // this.firstCell = undefined;
    // this.lastCell = undefined;
    // this.cellCount = undefined;
    this.contentElement = undefined;
    this._cells = Ember.A();
    this._cellMap = Object.create(null);

    // TODO: Super calls should always be at the top of the constructor.
    // I had to move the super call after the properties were defined to
    // work around what I believe is a bug in the attrs proxy. The problem
    // seems to arise when you:
    //
    //   1. Call this._super() immediately.
    //   2. Set a property on `this` that is both not in the
    //      initial attrs hash and not on the prototype.
    this._super();
  },

  didInitAttrs() {
    let buffer = this.getAttr('buffer'); // getIntAttr('buffer', 5)
    this._buffer = (typeof buffer === 'number') ? buffer : 5;
    this._scrollLeft = this.getAttr('scroll-left') | 0;
    this._scrollTop = this.getAttr('scroll-top') | 0;
    this._clientSize = {
      width:  this.getAttr('estimated-width') | 0,
      height: this.getAttr('estimated-height') | 0
    };
  },

  _needsRevalidate(){
    needsRevalidate(this);
  },

  didReceiveAttrs() {
    // Work around emberjs/ember.js#11992. Affects <=1.13.8 and <=2.0.0.
    // This will likely be patched in 1.13.9 and 2.0.1.
    this._super();

    this._cellLayout = this.getAttr('cell-layout');

    var items = this.getAttr('items');

    if (this._items !== items) {
      if (this._items && this._items.removeObserver) {
        this._items.removeObserver('[]', this, this._needsRevalidate);
      }

      this.set('_items', items);

      if (items && items.addObserver) {
        items.addObserver('[]', this, this._needsRevalidate);
      }
    }
  },

  updateContentSize() {
    var cellLayout = this._cellLayout;
    var contentSize = cellLayout.contentSize(this._clientSize);
    if (this._contentSize === undefined ||
        contentSize.width !== this._contentSize.width ||
        contentSize.height !== this._contentSize.height) {
      this.set('_contentSize', contentSize);
    }
  },

  willRender: function() {
    this.updateCells();
    this.updateContentSize();
  },

  updateCells() {
    if (!this._items) { return; }
    if (this._cellLayout.length !== this._items.length) {
      this._cellLayout.length = this._items.length;
    }

    var priorMap = this._cellMap;
    var cellMap = Object.create(null);

    var index = this._cellLayout.indexAt(this._scrollLeft, this._scrollTop, this._clientSize.width, this._clientSize.height);
    var count = this._cellLayout.count(this._scrollLeft, this._scrollTop, this._clientSize.width, this._clientSize.height);
    var items = this._items;
    var bufferBefore = Math.min(index, this._buffer);
    index -= bufferBefore;
    count += bufferBefore;
    count = Math.min(count + this._buffer, get(items, 'length') - index);
    var i, pos, width, height, style, itemIndex, itemKey, cell;

    var newItems = [];

    for (i=0; i<count; i++) {
      itemIndex = index+i;
      itemKey = decodeEachKey(items[itemIndex], '@identity');
      if (priorMap) {
        cell = priorMap[itemKey];
      }
      if (cell) {
        pos = this._cellLayout.positionAt(itemIndex, this._clientSize.width, this._clientSize.height);
        width = this._cellLayout.widthAt(itemIndex, this._clientSize.width, this._clientSize.height);
        height = this._cellLayout.heightAt(itemIndex, this._clientSize.width, this._clientSize.height);
        style = formatStyle(pos, width, height);
        set(cell, 'style', style);
        set(cell, 'hidden', false);
        set(cell, 'key', itemKey);
        cellMap[itemKey] = cell;
      } else {
        newItems.push(itemIndex);
      }
    }

    for (i=0; i<this._cells.length; i++) {
      cell = this._cells[i];
      if (!cellMap[cell.key]) {
        if (newItems.length) {
          itemIndex = newItems.pop();
          itemKey = decodeEachKey(items[itemIndex], '@identity');
          pos = this._cellLayout.positionAt(itemIndex, this._clientSize.width, this._clientSize.height);
          width = this._cellLayout.widthAt(itemIndex, this._clientSize.width, this._clientSize.height);
          height = this._cellLayout.heightAt(itemIndex, this._clientSize.width, this._clientSize.height);
          style = formatStyle(pos, width, height);
          set(cell, 'style', style);
          set(cell, 'key', itemKey);
          set(cell, 'index', itemIndex);
          set(cell, 'item', items[itemIndex]);
          set(cell, 'hidden', false);
          cellMap[itemKey] = cell;
        } else {
          set(cell, 'hidden', true);
          set(cell, 'style', 'height: 0; display: none;');
        }
      }
    }

    for (i=0; i<newItems.length; i++) {
      itemIndex = newItems[i];
      itemKey = decodeEachKey(items[itemIndex], '@identity');
      pos = this._cellLayout.positionAt(itemIndex, this._clientSize.width, this._clientSize.height);
      width = this._cellLayout.widthAt(itemIndex, this._clientSize.width, this._clientSize.height);
      height = this._cellLayout.heightAt(itemIndex, this._clientSize.width, this._clientSize.height);
      style = formatStyle(pos, width, height);
      cell = new Cell(itemKey, items[itemIndex], itemIndex, style);
      cellMap[itemKey] = cell;
      this._cells.pushObject(cell);
    }
    this._cellMap = cellMap;
  },
  actions: {
    scrollChange({scrollLeft, scrollTop}) {
      if (scrollLeft !== this._scrollLeft ||
          scrollTop !== this._scrollTop) {
        set(this, '_scrollLeft', scrollLeft);
        set(this, '_scrollTop', scrollTop);
        needsRevalidate(this);
      }
    },
    clientSizeChange(clientSize) {
      if (this._clientSize === undefined ||
          clientSize.width !== this._clientSize.width ||
          clientSize.height !== this._clientSize.height) {
        set(this, '_clientSize', clientSize);
        needsRevalidate(this);
      }
    }
  }
});