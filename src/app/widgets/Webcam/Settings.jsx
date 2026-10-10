import noop from 'lodash/noop';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Select from 'react-select';
import styled from 'styled-components';
import Margin from 'app/components/Margin';
import Modal from 'app/components/Modal';
import i18n from 'app/lib/i18n';
import log from 'app/lib/log';
import {
  MEDIA_SOURCE_LOCAL,
  MEDIA_SOURCE_STREAM
} from './constants';

const MutedText = styled.div`
    display: inline-block;
    color: #767676;
`;

class Settings extends PureComponent {
    static propTypes = {
      mediaSource: PropTypes.string,
      deviceId: PropTypes.string,
      url: PropTypes.string,
      onSave: PropTypes.func,
      onCancel: PropTypes.func
    };

    static defaultProps = {
      mediaSource: MEDIA_SOURCE_LOCAL,
      deviceId: '',
      url: '',
      onSave: noop,
      onCancel: noop
    };

    state = {
      mediaSource: this.props.mediaSource,
      deviceId: this.props.deviceId,
      url: this.props.url,
      videoDevices: []
    };

    handleChangeVideoDevice = (option) => {
      const deviceId = option.value;
      this.setState({ deviceId: deviceId });
    };

    handleChangeURL = (event) => {
      const url = event.target.value;
      this.setState({ url: url });
    };

    handleSave = () => {
      this.props.onSave && this.props.onSave({
        mediaSource: this.state.mediaSource,
        deviceId: this.state.deviceId,
        url: this.state.url
      });
    };

    handleCancel = () => {
      this.props.onCancel && this.props.onCancel();
    };

    enumerateDevices = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        // enumerateDevices() not supported.
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => (device.kind === 'videoinput'));
        this.setState({ videoDevices: videoDevices });
      } catch (err) {
        log.error(err.name + ': ' + err.message);
      }
    };

    componentDidMount() {
      this.enumerateDevices();
    }

    render() {
      const {
        mediaSource,
        deviceId,
        url,
        videoDevices
      } = this.state;

      const videoDeviceOptions = videoDevices.map(device => ({
        value: device.deviceId,
        label: device.label
      }));
      videoDeviceOptions.unshift({
        value: '',
        label: i18n._('Automatic detection')
      });

      return (
        <Modal disableOverlay size="sm" onClose={this.handleCancel}>
          <Modal.Header>
            <Modal.Title>{i18n._('Webcam Settings')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="form-group">
              <label><strong>{i18n._('Media Source')}</strong></label>
              <div className="radio" style={{ marginTop: 0 }}>
                <label>
                  <input
                    type="radio"
                    name="mediaSource"
                    value={MEDIA_SOURCE_LOCAL}
                    checked={mediaSource === MEDIA_SOURCE_LOCAL}
                    onChange={() => {
                      this.setState({ mediaSource: MEDIA_SOURCE_LOCAL });
                    }}
                  />
                  {i18n._('Use a camera connected to this browser device')}
                </label>
              </div>
              <div style={{ marginLeft: 20 }}>
                <Select
                  backspaceRemoves={false}
                  clearable={false}
                  disabled={mediaSource !== MEDIA_SOURCE_LOCAL}
                  name="videoDevice"
                  noResultsText={i18n._('No video devices available')}
                  onChange={this.handleChangeVideoDevice}
                  optionRenderer={(device) => device.label || device.deviceId}
                  options={videoDeviceOptions}
                  placeholder={i18n._('Choose a video device')}
                  searchable={false}
                  value={deviceId}
                />
              </div>
              <div className="radio">
                <label>
                  <input
                    type="radio"
                    name="mediaSource"
                    value={MEDIA_SOURCE_STREAM}
                    checked={mediaSource === MEDIA_SOURCE_STREAM}
                    onChange={() => {
                      this.setState({ mediaSource: MEDIA_SOURCE_STREAM });
                    }}
                  />
                  {i18n._('Use a network camera stream')}
                </label>
              </div>
              <div style={{ marginLeft: 20 }}>
                <button
                  type="button"
                  className="btn btn-default"
                  style={{ marginBottom: 10 }}
                  onClick={() => this.setState({ mediaSource: MEDIA_SOURCE_STREAM, url: 'camera/?action=stream' })}
                >
                  {i18n._('Raspberry Pi USB camera')}
                </button>
                <input
                  type="text"
                  className="form-control"
                  disabled={mediaSource !== MEDIA_SOURCE_STREAM}
                  placeholder="http://0.0.0.0:8080/?action=stream"
                  value={url}
                  onChange={this.handleChangeURL}
                />
                <Margin top={4}>
                  <MutedText style={{ marginTop: 4 }}>
                    {i18n._('Use an HTTP Motion JPEG stream or a browser-playable MP4 URL. RTSP requires a separate gateway. A Pi USB camera must be served by the Pi, not by browser camera access.')}
                  </MutedText>
                </Margin>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-default"
              onClick={this.handleCancel}
            >
              {i18n._('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleSave}
            >
              {i18n._('Save Changes')}
            </button>
          </Modal.Footer>
        </Modal>
      );
    }
}

export default Settings;
