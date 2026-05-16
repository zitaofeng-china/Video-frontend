// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock MediaStream and MediaStreamTrack for WebRTC tests
class MockMediaStreamTrack {
  kind: string;
  id: string;
  enabled: boolean;
  onended: (() => void) | null = null;
  
  constructor(kind: string, id: string) {
    this.kind = kind;
    this.id = id;
    this.enabled = true;
  }
  
  stop() {
    if (this.onended) {
      this.onended();
    }
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[];
  
  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.tracks = tracks;
  }
  
  getTracks() {
    return this.tracks;
  }
  
  getAudioTracks() {
    return this.tracks.filter(track => track.kind === 'audio');
  }
  
  getVideoTracks() {
    return this.tracks.filter(track => track.kind === 'video');
  }
  
  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track);
  }
  
  removeTrack(track: MockMediaStreamTrack) {
    const index = this.tracks.indexOf(track);
    if (index > -1) {
      this.tracks.splice(index, 1);
    }
  }
}

// Add to global scope
(global as any).MediaStream = MockMediaStream;
(global as any).MediaStreamTrack = MockMediaStreamTrack;

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  private senders: any[] = [];
  
  getSenders() {
    return this.senders;
  }
  
  addTrack(track: any, stream: any) {
    const sender = {
      track,
      replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    this.senders.push(sender);
    return sender;
  }
  
  close() {}
}

(global as any).RTCPeerConnection = MockRTCPeerConnection;
