export type Subject = {
  name: [
    {
      nameParts: [
        {
          type: "GivenName";
          value: string;
        },
        {
          type: "FamilyName";
          value: string;
        },
      ];
    },
  ];
};
