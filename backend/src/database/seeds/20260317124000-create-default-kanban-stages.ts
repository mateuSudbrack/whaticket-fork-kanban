import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkInsert(
      "KanbanStages",
      [
        {
          name: "Entrada",
          color: "#f57c00",
          sortOrder: 0,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Em andamento",
          color: "#1976d2",
          sortOrder: 1,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Concluido",
          color: "#2e7d32",
          sortOrder: 2,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      {}
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete("KanbanStages", {});
  }
};
