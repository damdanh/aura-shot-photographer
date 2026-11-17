module.exports = function softDeletePlugin(schema) {
  schema.add({
    isDeleted: {
      type: Boolean,
      required: true,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  });
  schema.methods.softDelete = async function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };
  schema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = null;
    return this.save();
  };

const excludeDeleted = function() {
  this.where({ isDeleted: { $ne: true } });
};
  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
};
