import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppTabs from './AppTabs';
import WarehouseScreen from '../../screen/app/WarehouseScreen';
import FinanceScreen from '../../screen/app/FinanceScreen';

// New static screens for Marketplace & Trades flow
import CommodityDetailsScreen from '../../screen/app/Marketplace/CommodityDetailsScreen';
import CommodityDetailsOwnerScreen from '../../screen/app/Marketplace/CommodityDetailsOwnerScreen';
import ReceivedOffersScreen from '../../screen/app/Trades/ReceivedOffersScreen';
import NegotiationDetailsScreen from '../../screen/app/Trades/NegotiationDetailsScreen';
import DealDetailsScreen from '../../screen/app/Trades/DealDetailsScreen';

const Stack = createNativeStackNavigator();

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={AppTabs} />
      <Stack.Screen name="WarehouseScreen" component={WarehouseScreen} />
      <Stack.Screen name="FinanceScreen" component={FinanceScreen} />
      
      {/* Marketplace & Trades flows */}
      <Stack.Screen name="CommodityDetails" component={CommodityDetailsScreen} />
      <Stack.Screen name="CommodityDetailsOwner" component={CommodityDetailsOwnerScreen} />
      <Stack.Screen name="ReceivedOffers" component={ReceivedOffersScreen} />
      <Stack.Screen name="NegotiationDetails" component={NegotiationDetailsScreen} />
      <Stack.Screen name="DealDetails" component={DealDetailsScreen} />
    </Stack.Navigator>
  );
}

