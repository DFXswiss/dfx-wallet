import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DashboardHeader } from '../../src/components/DashboardHeader';

describe('DashboardHeader', () => {
  it('renders both icon buttons when both handlers are provided', () => {
    const onMenu = jest.fn();
    const onShield = jest.fn();
    const { getByTestId } = render(
      <DashboardHeader onMenuPress={onMenu} onShieldPress={onShield} />,
    );
    expect(getByTestId('dashboard-shield-button')).toBeTruthy();
    expect(getByTestId('dashboard-menu-button')).toBeTruthy();
  });

  it('hides the menu button when onMenuPress is omitted (MVP build)', () => {
    const { queryByTestId, getByTestId } = render(
      <DashboardHeader onShieldPress={() => undefined} />,
    );
    expect(getByTestId('dashboard-shield-button')).toBeTruthy();
    expect(queryByTestId('dashboard-menu-button')).toBeNull();
  });

  it('hides the shield button when onShieldPress is omitted', () => {
    const { queryByTestId, getByTestId } = render(<DashboardHeader onMenuPress={() => undefined} />);
    expect(getByTestId('dashboard-menu-button')).toBeTruthy();
    expect(queryByTestId('dashboard-shield-button')).toBeNull();
  });

  it('renders neither button when both handlers are omitted (full MVP)', () => {
    const { queryByTestId } = render(<DashboardHeader />);
    expect(queryByTestId('dashboard-menu-button')).toBeNull();
    expect(queryByTestId('dashboard-shield-button')).toBeNull();
  });

  it('fires onMenuPress when the menu button is tapped', () => {
    const onMenu = jest.fn();
    const { getByTestId } = render(<DashboardHeader onMenuPress={onMenu} />);
    fireEvent.press(getByTestId('dashboard-menu-button'));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('fires onShieldPress when the shield button is tapped', () => {
    const onShield = jest.fn();
    const { getByTestId } = render(<DashboardHeader onShieldPress={onShield} />);
    fireEvent.press(getByTestId('dashboard-shield-button'));
    expect(onShield).toHaveBeenCalledTimes(1);
  });
});
