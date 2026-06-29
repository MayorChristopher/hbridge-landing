import AsyncStorage from '@react-native-async-storage/async-storage';

export class NavigationStateService {
  private static readonly LAST_ROUTE_KEY = 'lastRoute';
  private static readonly LAST_PARAMS_KEY = 'lastParams';

  static async saveLastRoute(routeName: string, params?: any): Promise<void> {
    try {
      await AsyncStorage.setItem(this.LAST_ROUTE_KEY, routeName);
      if (params) {
        await AsyncStorage.setItem(this.LAST_PARAMS_KEY, JSON.stringify(params));
      }
    } catch (error) {
      console.error('Error saving last route:', error);
    }
  }

  static async getLastRoute(): Promise<{ routeName: string; params?: any } | null> {
    try {
      const routeName = await AsyncStorage.getItem(this.LAST_ROUTE_KEY);
      if (!routeName) return null;

      const paramsStr = await AsyncStorage.getItem(this.LAST_PARAMS_KEY);
      const params = paramsStr ? JSON.parse(paramsStr) : undefined;

      return { routeName, params };
    } catch (error) {
      console.error('Error getting last route:', error);
      return null;
    }
  }

  static async clearLastRoute(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.LAST_ROUTE_KEY);
      await AsyncStorage.removeItem(this.LAST_PARAMS_KEY);
    } catch (error) {
      console.error('Error clearing last route:', error);
    }
  }
}
