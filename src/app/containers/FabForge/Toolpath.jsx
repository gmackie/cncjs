import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import styles from './index.styl';

const project = (p, view) => {
  if (view === 'front') {
    return [p[0], p[2]];
  }
  if (view === 'iso') {
    return [(p[0] - p[1]) * 0.707, (p[0] + p[1]) * 0.354 + p[2] * 0.866];
  }
  return [p[0], p[1]];
};

export default class Toolpath extends PureComponent {
  static propTypes = { review: PropTypes.object.isRequired, onViewed: PropTypes.func.isRequired };
  state = { index: 0, playing: false, view: 'iso', speed: 10 };

  componentDidMount() {
    this.draw();
  }
  componentDidUpdate(prevProps, prevState) {
    if (prevProps.review !== this.props.review || prevState.view !== this.state.view) {
      this.draw();
    }
    this.drawCursor();
  }
  componentWillUnmount() {
    clearInterval(this.timer);
  }

  draw = () => {
    const { segments } = this.props.review.analysis;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, 900, 460);
    if (!segments.length) {
      return;
    }
    const points = segments.reduce((all, item) => {
      all.push(project(item.from, this.state.view), project(item.to, this.state.view));
      return all;
    }, []);
    const bounds = points.reduce(
      (b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])],
      [Infinity, Infinity, -Infinity, -Infinity]
    );
    const scale = Math.min(830 / Math.max(1, bounds[2] - bounds[0]), 390 / Math.max(1, bounds[3] - bounds[1]));
    this.toScreen = (p) => {
      const v = project(p, this.state.view);
      return [450 + (v[0] - (bounds[0] + bounds[2]) / 2) * scale, 230 - (v[1] - (bounds[1] + bounds[3]) / 2) * scale];
    };
    // Batch by motion type; playback only redraws the cursor overlay.
    [true, false].forEach((rapid) => {
      ctx.beginPath();
      ctx.strokeStyle = rapid ? '#e5a65d' : '#71d7b1';
      ctx.lineWidth = rapid ? 1 : 1.5;
      ctx.setLineDash(rapid ? [4, 4] : []);
      segments.forEach((item) => {
        if ((item.motion === 0) !== rapid) {
          return;
        }
        ctx.moveTo(...this.toScreen(item.from));
        ctx.lineTo(...this.toScreen(item.to));
      });
      ctx.stroke();
    });
    this.drawCursor();
  };

  drawCursor = () => {
    const ctx = this.cursor.getContext('2d');
    ctx.clearRect(0, 0, 900, 460);
    const item = this.props.review.analysis.segments[this.state.index];
    if (!item || !this.toScreen) {
      return;
    }
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(...this.toScreen(item.to), 5, 0, Math.PI * 2);
    ctx.fill();
  };

  pause = () => {
    clearInterval(this.timer);
    this.setState({ playing: false });
  };
  play = () => {
    const { segments } = this.props.review.analysis;
    if (!segments.length) {
      return;
    }
    clearInterval(this.timer);
    let index = this.state.index >= segments.length - 1 ? 0 : this.state.index;
    let remaining = segments[index].seconds;
    let previous = Date.now();
    this.setState({ playing: true, index });
    this.timer = setInterval(() => {
      const now = Date.now();
      remaining -= ((now - previous) / 1000) * this.state.speed;
      previous = now;
      while (remaining <= 0 && index < segments.length - 1) {
        index++;
        remaining += segments[index].seconds;
      }
      this.setState({ index });
      if (index === segments.length - 1 && remaining <= 0) {
        this.pause();
        this.props.onViewed();
      }
    }, 100);
  };

  render() {
    const { analysis } = this.props.review;
    const item = analysis.segments[this.state.index];
    return (
      <div>
        <div className={styles.toolbar}>
          <label>
            View{' '}
            <select value={this.state.view} onChange={(e) => this.setState({ view: e.target.value })}>
              <option value="iso">Isometric</option>
              <option value="top">Top XY</option>
              <option value="front">Front XZ</option>
            </select>
          </label>
          <span>Green: feed · dashed amber: rapid · white: tool</span>
        </div>
        <div className={styles.plot} role="img" aria-label="Offline G-code tool-center backplot">
          <canvas
            width="900"
            height="460"
            ref={(node) => {
              this.canvas = node;
            }}
          />
          <canvas
            width="900"
            height="460"
            className={styles.cursor}
            ref={(node) => {
              this.cursor = node;
            }}
          />
        </div>
        <div className={styles.toolbar}>
          <button type="button" disabled={!item} onClick={this.state.playing ? this.pause : this.play}>
            {this.state.playing ? 'Pause simulation' : 'Play simulation'}
          </button>
          <label>
            Speed{' '}
            <select value={this.state.speed} onChange={(e) => this.setState({ speed: Number(e.target.value) })}>
              {[1, 10, 50, 100].map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
            </select>
          </label>
          <span>
            {item
              ? `Line ${item.line} · G${item.motion} · ${item.spindle} S${item.power} · T${item.tool}`
              : 'No supported motion'}
          </span>
        </div>
        <label className={styles.scrubber}>
          Toolpath position
          <input
            aria-label="Toolpath position"
            type="range"
            min="0"
            max={Math.max(0, analysis.segments.length - 1)}
            value={this.state.index}
            onChange={(e) => {
              this.pause();
              this.setState({ index: Number(e.target.value) });
            }}
          />
        </label>
        <p>{item && `Work XYZ: ${item.to.map((v) => v.toFixed(3)).join(', ')} mm`}</p>
      </div>
    );
  }
}
