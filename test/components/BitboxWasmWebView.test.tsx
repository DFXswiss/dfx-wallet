import { render, act } from '@testing-library/react-native';
import { BitboxWasmWebView } from '../../src/features/hardware-wallet/services/BitboxWasmWebView';
import type { WasmBridge } from '../../src/features/hardware-wallet/services/wasm-bridge';

// Mock the native WebView: capture its onMessage prop so tests can deliver
// frames, and expose injectJavaScript through the ref so the bridge's
// postMessage hook is exercised.
jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference out-of-scope imports
  const React = require('react');
  const state: {
    onMessage: ((e: { nativeEvent: { data: string } }) => void) | undefined;
    inject: jest.Mock;
  } = { onMessage: undefined, inject: jest.fn() };
  const WebView = React.forwardRef(
    (props: { onMessage?: (e: { nativeEvent: { data: string } }) => void }, ref: unknown) => {
      state.onMessage = props.onMessage;
      React.useImperativeHandle(ref, () => ({ injectJavaScript: state.inject }));
      return null;
    },
  );
  WebView.displayName = 'MockWebView';
  return { WebView, __state: state };
});

const webView = jest.requireMock('react-native-webview').__state as {
  onMessage: ((e: { nativeEvent: { data: string } }) => void) | undefined;
  inject: jest.Mock;
};

function makeBridge() {
  return {
    onMessage: jest.fn(),
    setWebView: jest.fn(),
    destroy: jest.fn(),
  } as unknown as WasmBridge & {
    onMessage: jest.Mock;
    setWebView: jest.Mock;
    destroy: jest.Mock;
  };
}

function deliver(data: string) {
  act(() => {
    webView.onMessage!({ nativeEvent: { data } });
  });
}

describe('BitboxWasmWebView', () => {
  beforeEach(() => {
    webView.inject.mockClear();
  });

  it('registers the WebView with the bridge on mount', () => {
    const bridge = makeBridge();
    render(<BitboxWasmWebView bridge={bridge} />);
    expect(bridge.setWebView).toHaveBeenCalledTimes(1);
  });

  it('routes the bridge postMessage hook through the WebView via injectJavaScript', () => {
    const bridge = makeBridge();
    render(<BitboxWasmWebView bridge={bridge} />);

    const { postMessage } = bridge.setWebView.mock.calls[0][0];
    postMessage('{"id":1}');

    expect(webView.inject).toHaveBeenCalledTimes(1);
    const injected = webView.inject.mock.calls[0][0] as string;
    // The payload must be JSON-encoded into a dispatched MessageEvent.
    expect(injected).toContain('dispatchEvent');
    expect(injected).toContain(JSON.stringify('{"id":1}'));
  });

  it('calls onReady for a "ready" frame and does not forward it to the bridge', () => {
    const bridge = makeBridge();
    const onReady = jest.fn();
    render(<BitboxWasmWebView bridge={bridge} onReady={onReady} />);

    deliver(JSON.stringify({ type: 'ready' }));

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(bridge.onMessage).not.toHaveBeenCalled();
  });

  it('does not crash on a "ready" frame when no onReady is provided', () => {
    const bridge = makeBridge();
    render(<BitboxWasmWebView bridge={bridge} />);

    expect(() => deliver(JSON.stringify({ type: 'ready' }))).not.toThrow();
    expect(bridge.onMessage).not.toHaveBeenCalled();
  });

  it('swallows "error" frames without forwarding them to the bridge', () => {
    const bridge = makeBridge();
    const onReady = jest.fn();
    render(<BitboxWasmWebView bridge={bridge} onReady={onReady} />);

    deliver(JSON.stringify({ type: 'error', message: 'boom' }));

    expect(bridge.onMessage).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('forwards RPC frames to the bridge verbatim', () => {
    const bridge = makeBridge();
    render(<BitboxWasmWebView bridge={bridge} />);

    const rpc = JSON.stringify({ id: 7, result: 'ok' });
    deliver(rpc);

    expect(bridge.onMessage).toHaveBeenCalledWith(rpc);
  });

  it('forwards non-JSON payloads to the bridge instead of throwing', () => {
    const bridge = makeBridge();
    render(<BitboxWasmWebView bridge={bridge} />);

    deliver('not-json');

    expect(bridge.onMessage).toHaveBeenCalledWith('not-json');
  });

  it('destroys the bridge on unmount', () => {
    const bridge = makeBridge();
    const { unmount } = render(<BitboxWasmWebView bridge={bridge} />);

    unmount();

    expect(bridge.destroy).toHaveBeenCalledTimes(1);
  });
});
