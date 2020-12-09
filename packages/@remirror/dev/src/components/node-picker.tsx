import styled from '@emotion/styled';
import React from 'react';

import theme from '../dev-theme';

const icon = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Crect width='1024' height='1024' fill='%237963D2' fill-rule='nonzero' rx='90'/%3E%3Cg transform='translate(17 90)'%3E%3Crect width='488' height='843' fill='%23FFF' fill-rule='nonzero' opacity='.15'/%3E%3Crect width='488' height='843' x='502' opacity='.5'/%3E%3Crect width='13' height='843' x='489' fill='%23FFF' fill-rule='nonzero'/%3E%3Cpath fill='%23FFF' fill-rule='nonzero' d='M636.45502 228.414115C676.811779 227.882026 716.492841 238.328573 750.855822 258.531588 760.907187 240.044158 780.906097 228.433201 802.730668 228.414115L855 228.414115 855 635C819.785592 635 792.526642 625.789073 773.223151 607.367219 754.451622 590.149574 743.972535 566.29284 744.267913 541.4476L744.267913 433.928221C744.604461 406.388055 733.215967 379.896443 712.709071 360.516881 692.968937 340.453858 665.290313 329.248546 636.45502 329.646471 611.572191 329.950275 587.667577 320.410859 570.418143 303.293682 552.008818 285.725156 542.869904 260.627262 543 228L636.45502 228.414115zM353.497692 228.414115C313.120511 227.882026 273.41937 238.328573 239.039002 258.531588 228.982551 240.044158 208.973521 228.433201 187.137907 228.414115L135 228.414115 135 635C170.232227 635 197.504969 625.789073 216.818229 607.367219 235.599256 590.149574 246.083645 566.29284 245.788118 541.4476L245.788118 433.928221C245.4514 406.388055 256.845657 379.896443 277.362929 360.516881 297.075807 340.492839 324.702489 329.291031 353.497692 329.646471 378.393111 329.950275 402.309821 320.410859 419.567983 303.293682 437.986623 285.725156 447.130162 260.627262 447 228L353.497692 228.414115z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E`;

const NodePickerStyled = styled('div')(
  {
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    background: 'rgba(0, 0, 255, 0.3)',
    zIndex: 99999,
    cursor: 'pointer',
  },
  ({ nodePicker }) => ({
    transform: `translateX(${nodePicker.left}px) translateY(${nodePicker.top}px)`,
    display: nodePicker.top && nodePicker.left ? 'block' : 'none',
    width: `${nodePicker.width}px`,
    height: `${nodePicker.height}px`,
  }),
);

class NodePicker extends React.Component {
  componentDidMount() {
    if (this.props.nodePicker.active) {
      this.initEventHandlers();
    }
  }

  componentWillReceiveProps(nextProps) {
    this.destroyEventHandlers();

    if (nextProps.nodePicker.active) {
      this.initEventHandlers();
    }
  }

  componentWillUnmount() {
    this.destroyEventHandlers();
  }

  initEventHandlers() {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleNodeClick);
    document.addEventListener('keydown', this.closePicker);
  }

  destroyEventHandlers() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleNodeClick);
    document.removeEventListener('keydown', this.closePicker);
  }

  handleMouseMove = (e) => {
    if (!this.props.nodePicker.active) {
      return;
    }

    this.props.onMouseMove(e.target);
  };

  handleNodeClick = (e) => {
    if (!this.props.nodePicker.active) {
      return;
    }

    e.preventDefault();
    this.props.onSelect(e.target);
  };

  closePicker = () => {
    if (!this.props.nodePicker.active) {
      return;
    }

    this.props.onClose();
  };

  render() {
    return <NodePickerStyled nodePicker={this.props.nodePicker} />;
  }
}

export const NodePickerTrigger = styled('div')(
  {
    position: 'absolute',
    right: '4px',
    top: '-28px',
    width: '24px',
    height: '24px',
    borderRadius: '3px',

    '&:hover': {
      backgroundColor: theme.main80,
      cursor: 'pointer',
    },
  },
  ({ isActive }) => ({
    background: `${isActive ? theme.main : theme.main60} url("${icon}")`,
    backgroundSize: '20px 20px',
    backgroundRepeat: 'none',
    backgroundPosition: '50% 50%',
  }),
);
