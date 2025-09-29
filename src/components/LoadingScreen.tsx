import React from "react";
import { Modal, View, ActivityIndicator, Text } from "react-native";

type LoaderModalProps = {
    visible: boolean;
    text?: string;
}

export const LoaderModal: React.FC<LoaderModalProps> = ({ visible, text }) => {
    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
        >
            <View className="flex-1 items-center justify-center bg-black/50">
                <View className="bg-white p-6 rounded-2xl items-center space-y-3">
                    <ActivityIndicator size="large" color="#2563eb" />
                    {text && (
                        <Text className="text-base font-medium text-gray-700">
                            {text}
                        </Text>
                    )}
                </View>
            </View>
        </Modal>
    );
};