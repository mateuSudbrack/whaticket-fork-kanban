import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ContactPipelineMemberships", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      pipelineId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "KanbanPipelines", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      kanbanStageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "KanbanStages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex(
      "ContactPipelineMemberships",
      ["contactId", "pipelineId"],
      {
        unique: true,
        name: "contact_pipeline_unique_membership"
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ContactPipelineMemberships",
      "contact_pipeline_unique_membership"
    );
    await queryInterface.dropTable("ContactPipelineMemberships");
  }
};
