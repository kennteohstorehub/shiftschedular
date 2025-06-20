const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Skill = sequelize.define('Skill', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    category: {
      type: DataTypes.ENUM('technical', 'product', 'language', 'soft_skill', 'specialized'),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: '1 = highest priority, 5 = lowest priority',
    },
    // Skill requirements
    required_for_channels: {
      type: DataTypes.JSON,
      comment: 'Array of channel IDs that require this skill',
      defaultValue: [],
    },
    certification_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    training_hours_required: {
      type: DataTypes.INTEGER,
      comment: 'Minimum training hours required for this skill',
      defaultValue: 0,
    },
    // Skill levels
    proficiency_levels: {
      type: DataTypes.JSON,
      comment: 'Available proficiency levels for this skill',
      defaultValue: ['beginner', 'intermediate', 'advanced', 'expert'],
    },
    minimum_proficiency_required: {
      type: DataTypes.STRING,
      defaultValue: 'beginner',
    },
    // Performance impact
    handle_time_modifier: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Modifier for handle time (1.0 = no change, 0.9 = 10% faster)',
      defaultValue: 1.0,
    },
    quality_score_impact: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Impact on quality scores (1.0 = no impact, 1.1 = 10% improvement)',
      defaultValue: 1.0,
    },
    // Scheduling preferences
    preferred_concurrent_limit: {
      type: DataTypes.INTEGER,
      comment: 'Preferred limit for concurrent interactions requiring this skill',
      defaultValue: 1,
    },
    // Metadata
    tags: {
      type: DataTypes.JSON,
      comment: 'Array of tags for categorization and filtering',
      defaultValue: [],
    },
    prerequisites: {
      type: DataTypes.JSON,
      comment: 'Array of skill IDs that are prerequisites for this skill',
      defaultValue: [],
    },
  }, {
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['category'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['priority'],
      },
    ],
    hooks: {
      beforeValidate: (skill) => {
        // Normalize skill name
        if (skill.name) {
          skill.name = skill.name.toLowerCase().replace(/\s+/g, '_');
        }
        
        // Set default display name if not provided
        if (!skill.display_name && skill.name) {
          skill.display_name = skill.name
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      },
    },
  });

  // Class methods
  Skill.getSkillsByCategory = function(category) {
    return this.findAll({
      where: { category, is_active: true },
      order: [['priority', 'ASC'], ['display_name', 'ASC']],
    });
  };

  Skill.getRequiredSkillsForChannel = function(channelId) {
    return this.findAll({
      where: {
        required_for_channels: {
          [sequelize.Sequelize.Op.contains]: [channelId],
        },
        is_active: true,
      },
    });
  };

  // Instance methods
  Skill.prototype.isValidProficiencyLevel = function(level) {
    return this.proficiency_levels.includes(level);
  };

  Skill.prototype.getProficiencyLevelRank = function(level) {
    return this.proficiency_levels.indexOf(level);
  };

  Skill.prototype.meetsMinimumRequirement = function(agentLevel) {
    const minRank = this.getProficiencyLevelRank(this.minimum_proficiency_required);
    const agentRank = this.getProficiencyLevelRank(agentLevel);
    return agentRank >= minRank;
  };

  return Skill;
}; 