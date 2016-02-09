import React from 'react';
import { History } from 'react-router';
import reactMixin from 'react-mixin';
import $ from '../../public/js/jquery-1.11.1.min';
import Loading from './Loading.js';
import Auth from '../utils/Auth';
import BroadcastSetupView from './BroadcastSetupView'

class BroadcastSetup extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: (new Date).getTime().toString() + Math.random().toFixed(2),
      broadcaster: 'anonymous',
      desc: 'Hi, I\'m anonymous and you\'re listening to QuantumRadio',
      isInitializing: false,
      isLoggedIn: false,
      isLive: "AUX",
      favorites: [],
      isLoading: false
    };
  }

  startBroadcast(streamData) {
    var serverURL = "http://localhost:3000/api/stream";

    this.setState({
      name: streamData.streamName,
      desc: streamData.desc,
      isLive: streamData.isLive,
      isLoading: true
    }, () => {
      $.ajax({
        url: serverURL,
        method: 'POST',
        contentType: "application/x-www-form-urlencoded",
        data: {
          name: this.state.name,
          creator: JSON.parse(localStorage.getItem("me")),
          desc: this.state.desc,
          lng: 40,
          lat: 30
        }
      })
      .done((responseData) => {
        this.setState({
          isLoading: false
        });
        this.props.history.push({
          pathname: '/broadcast/'+responseData._id,
          state: {
            streamId: responseData._id,
            isLive: this.state.isLive
          }
        });
      });
    })
  }

  render() {
    return <BroadcastSetupView
      startBroadcast={this.startBroadcast.bind(this)}
      isLive={this.state.isLive} />
  } 
}

reactMixin.onClass(BroadcastSetup, History);


export default BroadcastSetup;
