import { useMutation } from "@tanstack/react-query";
import { testImageHostingConnectionFn } from "@/features/image-hosting/api/image-hosting.api";

export function useImageHostingConnection() {
  const mutation = useMutation({
    mutationFn: testImageHostingConnectionFn,
  });

  return {
    testImageHostingConnection: mutation.mutateAsync,
  };
}
