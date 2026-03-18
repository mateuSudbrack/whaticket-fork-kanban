import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("FlowExecutions", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      flowId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Flows", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
      },
      triggerType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "manual"
      },
      context: {
        type: DataTypes.JSON,
        allowNull: false
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
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
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FlowExecutions");
  }
};
